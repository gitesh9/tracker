/**
 * Local Postgres (PGlite / WASM) — the app's durable store.
 *
 * Every screen reads and writes here first, with zero network involved. Rows are
 * kept as `jsonb` documents so the app's row shapes stay identical to the remote
 * Postgres schema while still being queryable with real SQL.
 *
 * The exposed `localDb` object mimics the small query-builder surface the app
 * already used, so call sites stay unchanged.
 */
import type { PGlite } from "@electric-sql/pglite";

export const LOCAL_TABLES = [
  "profiles",
  "tasks",
  "goals",
  "subtasks",
  "deferral_logs",
  "achievements",
  "focus_sessions",
  "reminders",
  "squads",
] as const;

export type LocalTable = (typeof LOCAL_TABLES)[number];

type Row = Record<string, unknown>;
export type Result<T> = { data: T | null; error: { message: string } | null };

let dbPromise: Promise<PGlite> | null = null;

function ddl(table: string): string {
  return `create table if not exists ${table} (
    id text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    deleted boolean not null default false
  );`;
}

export function isLocalDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export async function getDb(): Promise<PGlite> {
  if (!isLocalDbAvailable()) throw new Error("Local database is browser-only");
  if (!dbPromise) {
    dbPromise = (async () => {
      const { PGlite: Ctor } = await import("@electric-sql/pglite");
      const db = await Ctor.create("idb://ascend-local");
      for (const table of LOCAL_TABLES) await db.exec(ddl(table));
      await db.exec(
        `create table if not exists sync_state (key text primary key, value text not null);`,
      );
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Raw SQL escape hatch for reports, joins and aggregates. */
export async function sql<T = Row>(query: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.query<T>(query, params);
  return res.rows;
}

export async function getSyncState(key: string): Promise<string | null> {
  try {
    const rows = await sql<{ value: string }>(`select value from sync_state where key = $1`, [key]);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSyncState(key: string, value: string): Promise<void> {
  try {
    const db = await getDb();
    await db.query(
      `insert into sync_state (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value`,
      [key, value],
    );
  } catch {
    /* storage unavailable — sync simply restarts from scratch next time */
  }
}

function materialise(row: { id: string; data: Row; updated_at: string }): Row {
  return { ...row.data, id: row.id };
}

type Filter = { column: string; value: unknown };

class Builder<T> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private singleMode: "one" | "maybe" | null = null;

  constructor(
    private table: LocalTable,
    private action: "select" | "insert" | "upsert" | "update" | "delete",
    private payload?: Row | Row[],
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  select(_columns?: string) {
    return this;
  }

  single() {
    this.singleMode = "one";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  private where(): { clause: string; params: unknown[] } {
    if (this.filters.length === 0) return { clause: "", params: [] };
    const params: unknown[] = [];
    const parts = this.filters.map((f) => {
      params.push(f.value);
      return f.column === "id"
        ? `id = $${params.length}`
        : `data->>'${f.column}' = $${params.length}`;
    });
    return { clause: ` and ${parts.join(" and ")}`, params };
  }

  private async run(): Promise<Result<T>> {
    try {
      const db = await getDb();
      const t = this.table;

      if (this.action === "delete") {
        const { clause, params } = this.where();
        await db.query(
          `update ${t} set deleted = true, updated_at = now() where deleted = false${clause}`,
          params,
        );
        return { data: null, error: null };
      }

      if (this.action === "update") {
        const patch = (this.payload ?? {}) as Row;
        const { clause, params } = this.where();
        await db.query(
          `update ${t} set data = data || $1::jsonb, updated_at = now()
           where deleted = false${clause.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + 1}`)}`,
          [JSON.stringify({ ...patch, updated_at: new Date().toISOString() }), ...params],
        );
      }

      if (this.action === "insert" || this.action === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
        for (const row of rows) {
          const id = String(row["id"] ?? crypto.randomUUID());
          const data = { ...row, id, updated_at: row["updated_at"] ?? new Date().toISOString() };
          await db.query(
            `insert into ${t} (id, data, updated_at, deleted) values ($1, $2::jsonb, now(), false)
             on conflict (id) do update
             set data = ${t}.data || excluded.data, updated_at = now(), deleted = false`,
            [id, JSON.stringify(data)],
          );
        }
      }

      // Read back (select, or the *.select() chained onto a write)
      const { clause, params } = this.where();
      const orderSql = this.orderBy
        ? ` order by data->>'${this.orderBy.column}' ${this.orderBy.ascending ? "asc" : "desc"}`
        : ` order by updated_at desc`;
      const rows = await db.query<{ id: string; data: Row; updated_at: string }>(
        `select id, data, updated_at from ${t} where deleted = false${clause}${orderSql}`,
        params,
      );
      const items = rows.rows.map(materialise);

      if (this.singleMode) {
        const first = items[0] ?? null;
        if (!first && this.singleMode === "one") {
          return { data: null, error: { message: "No rows returned" } };
        }
        return { data: first as T, error: null };
      }
      return { data: items as T, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
  }

  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/* The app's row shapes come from its own generated types; the builder itself is
   schema-agnostic, so results are handed back loosely typed and narrowed by callers. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyBuilder = Builder<any>;

export const localDb = {
  from(table: LocalTable | string) {
    const t = table as LocalTable;
    return {
      select: (_columns?: string): AnyBuilder => new Builder<any>(t, "select"),
      insert: (payload: Row | Row[]): AnyBuilder => new Builder<any>(t, "insert", payload),
      upsert: (
        payload: Row | Row[],
        _opts?: { onConflict?: string; ignoreDuplicates?: boolean },
      ): AnyBuilder => new Builder<any>(t, "upsert", payload),
      update: (patch: Row): AnyBuilder => new Builder<any>(t, "update", patch),
      delete: (): AnyBuilder => new Builder<any>(t, "delete"),
    };
  },
};

/** Rows changed locally since a timestamp — used to push to the remote database. */
export async function localChangesSince(
  since: string,
): Promise<{ table: LocalTable; id: string; data: Row; updated_at: string; deleted: boolean }[]> {
  const out: { table: LocalTable; id: string; data: Row; updated_at: string; deleted: boolean }[] =
    [];
  for (const table of LOCAL_TABLES) {
    const rows = await sql<{ id: string; data: Row; updated_at: string; deleted: boolean }>(
      `select id, data, updated_at, deleted from ${table} where updated_at > $1`,
      [since],
    );
    for (const r of rows) out.push({ table, ...r });
  }
  return out;
}

/** Applies a row pulled from the remote database, newest write wins. */
export async function applyRemoteRow(
  table: LocalTable,
  id: string,
  data: Row,
  updatedAt: string,
  deleted: boolean,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `insert into ${table} (id, data, updated_at, deleted) values ($1, $2::jsonb, $3, $4)
     on conflict (id) do update
       set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
     where ${table}.updated_at < excluded.updated_at`,
    [id, JSON.stringify(data), updatedAt, deleted],
  );
}

/** Copies rows into the local database only when it does not hold them yet, so an
 *  older browser-storage copy can never overwrite newer synced data. */
export async function insertMissing(table: LocalTable, rows: Row[]): Promise<number> {
  const db = await getDb();
  let count = 0;
  for (const row of rows) {
    if (!row || typeof row["id"] !== "string") continue;
    const id = row["id"] as string;
    const res = await db.query(
      `insert into ${table} (id, data, updated_at, deleted) values ($1, $2::jsonb, now(), false)
       on conflict (id) do nothing`,
      [id, JSON.stringify({ ...row, id })],
    );
    count += res.affectedRows ?? 0;
  }
  return count;
}
