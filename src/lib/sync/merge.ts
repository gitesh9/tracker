/**
 * Field-level "latest edit wins" merge used by the sync server.
 *
 * Each field remembers when it was last edited. An incoming change only replaces a
 * field when it is at least as recent as the stored edit for that field, so two
 * devices editing different fields of the same task both keep their change, and an
 * older offline edit replayed late can never overwrite a newer one.
 */
export type FieldTimes = Record<string, number>;

export type MergeResult = {
  data: Record<string, unknown>;
  fieldTimes: FieldTimes;
  changed: boolean;
};

/** Fields the server/clients manage themselves; never decide a conflict. */
const IGNORED = new Set(["updated_at"]);

export function mergeFields(
  current: Record<string, unknown>,
  currentTimes: FieldTimes,
  incoming: Record<string, unknown>,
  at: number,
): MergeResult {
  const data = { ...current };
  const fieldTimes = { ...currentTimes };
  let changed = false;
  for (const [key, value] of Object.entries(incoming)) {
    if (IGNORED.has(key)) {
      data[key] = value;
      continue;
    }
    const previous = fieldTimes[key] ?? 0;
    if (at >= previous) {
      if (JSON.stringify(data[key]) !== JSON.stringify(value)) changed = true;
      data[key] = value;
      fieldTimes[key] = at;
    }
  }
  return { data, fieldTimes, changed };
}

/** Client clocks can drift; never let a device claim an edit far in the future. */
export function clampEditTime(at: number | undefined, serverNow: number): number {
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return serverNow;
  return Math.min(at, serverNow + 60_000);
}
