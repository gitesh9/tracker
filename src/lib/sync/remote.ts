/**
 * Optional remote sync. Everything here is best-effort: when there is no network,
 * or no DATABASE_URL configured on the server, the app keeps running purely on the
 * local Postgres database and the outbox simply waits.
 */
import { getAccountId, getDeviceId } from "@/lib/ascend/identity";
import {
  applyRemoteRow,
  getSyncState,
  isLocalDbAvailable,
  localChangesSince,
  setSyncState,
  type LocalTable,
} from "@/lib/db/pglite";

export type WireOp =
  | { kind: "upsert"; table: LocalTable; id: string; row: Record<string, unknown>; at?: number }
  | { kind: "update"; table: LocalTable; id: string; patch: Record<string, unknown>; at?: number }
  | { kind: "delete"; table: LocalTable; id: string };

type SyncResponse = {
  configured: boolean;
  now?: string;
  changes?: {
    table_name: LocalTable;
    row_id: string;
    data: Record<string, unknown>;
    updated_at: string;
    deleted: boolean;
  }[];
};

const CURSOR_KEY = "remote_cursor";
/** Which sync identity the cursor belongs to. When it changes (sign-in, sign-out,
 *  new sync key) the cursor is meaningless and everything must be re-exchanged. */
const CURSOR_ACCOUNT_KEY = "remote_cursor_account";
const EPOCH = "1970-01-01T00:00:00.000Z";
const BATCH = 400;

/** The account's session expired on this device: keep every change queued until the
 *  user signs in again rather than treating it as a bad row. */
export class SignInRequiredError extends Error {
  constructor() {
    super("Sign in again to keep syncing");
    this.name = "SignInRequiredError";
  }
}

async function call(body: Record<string, unknown>): Promise<SyncResponse> {
  const res = await fetch("/api/public/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ accountId: getAccountId(), deviceId: getDeviceId(), ...body }),
  });
  if (res.status === 401) throw new SignInRequiredError();
  if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
  return (await res.json()) as SyncResponse;
}

/** Every row held on this device, as wire ops — used once per account so data created
 *  before signing in (or on another sync key) reaches the account. */
async function fullUploadOps(): Promise<WireOp[]> {
  if (!isLocalDbAvailable()) return [];
  const rows = await localChangesSince(EPOCH);
  // Squads are shared with other people through their own endpoint, not per-account sync.
  return rows.filter((r) => r.table !== "squads").map((r) =>
    r.deleted
      ? { kind: "delete", table: r.table, id: r.id }
      : { kind: "upsert", table: r.table, id: r.id, row: r.data, at: Date.parse(r.updated_at) || 1 },
  );
}

/** Pushes outbox operations and pulls anything newer from the remote database.
 *  Returns false when no remote database is configured — the caller then drops the
 *  outbox, because the local database is the only source of truth. */
const changedTables = new Set<string>();
/** Tables that received rows from other devices since the last call (then cleared). */
export function takeChangedTables(): string[] {
  const list = [...changedTables];
  changedTables.clear();
  return list;
}

export async function syncWithRemote(ops: WireOp[]): Promise<boolean> {
  const account = getAccountId();
  const cursorAccount = await getSyncState(CURSOR_ACCOUNT_KEY);
  const accountChanged = cursorAccount !== account;

  let since = accountChanged ? EPOCH : ((await getSyncState(CURSOR_KEY)) ?? EPOCH);
  let pending = ops;
  if (accountChanged) {
    const all = await fullUploadOps();
    const queued = new Set(ops.map((o) => `${o.table}:${o.id}`));
    pending = [...all.filter((o) => !queued.has(`${o.table}:${o.id}`)), ...ops];
  }

  // Send in batches; the last batch also carries the pull.
  let result: SyncResponse = { configured: false };
  do {
    const batch = pending.slice(0, BATCH);
    pending = pending.slice(BATCH);
    result = await call({ ops: batch, since });
    if (!result.configured) {
      recordSyncStatus({ at: null, configured: false });
      return false;
    }
  } while (pending.length > 0);

  if (isLocalDbAvailable()) {
    for (const change of result.changes ?? []) {
      if (change.table_name === "squads") continue;
      changedTables.add(change.table_name);
      await applyRemoteRow(
        change.table_name,
        change.row_id,
        change.data,
        change.updated_at,
        change.deleted,
      );
    }
  }
  since = result.now ?? since;
  await setSyncState(CURSOR_KEY, since);
  await setSyncState(CURSOR_ACCOUNT_KEY, account);
  recordSyncStatus({ at: new Date().toISOString(), configured: true });
  return true;
}

export type SyncStatus = { at: string | null; configured: boolean };
const STATUS_KEY = "ascend.sync.status";

function recordSyncStatus(status: SyncStatus) {
  if (typeof window === "undefined") return;
  const previous = readSyncStatus();
  const next = { ...status, at: status.at ?? previous.at };
  try {
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("ascend:synced", { detail: next }));
}

/** When this device last completed a sync, and whether sync is set up at all. */
export function readSyncStatus(): SyncStatus {
  if (typeof window === "undefined") return { at: null, configured: true };
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as SyncStatus) : { at: null, configured: true };
  } catch {
    return { at: null, configured: true };
  }
}
