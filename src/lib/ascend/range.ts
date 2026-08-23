import { addDays, fromISO, toISO, todayISO } from "./cadence";

export type RangeKey = "7d" | "30d" | "90d" | "6m" | "1y" | "2y" | "all" | "custom";

export type DateRange = {
  key: RangeKey;
  label: string;
  from: string;
  to: string;
};

export const RANGE_PRESETS: { key: Exclude<RangeKey, "custom">; label: string; days: number }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "6m", label: "6M", days: 182 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "2y", label: "2Y", days: 730 },
  { key: "all", label: "All", days: 3650 },
];

export function presetRange(key: Exclude<RangeKey, "custom">): DateRange {
  const preset = RANGE_PRESETS.find((p) => p.key === key) ?? RANGE_PRESETS[1]!;
  const to = todayISO();
  return {
    key: preset.key,
    label: preset.key === "all" ? "All time" : `Last ${preset.label}`,
    from: preset.key === "all" ? "1970-01-01" : addDays(to, -preset.days + 1),
    to,
  };
}

export function customRange(from: string, to: string): DateRange {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return { key: "custom", label: `${formatShort(a)} → ${formatShort(b)}`, from: a, to: b };
}

export function rangeDays(range: DateRange): number {
  const start = range.from === "1970-01-01" ? addDays(range.to, -364) : range.from;
  return Math.max(
    1,
    Math.round((fromISO(range.to).getTime() - fromISO(start).getTime()) / 86_400_000) + 1,
  );
}

export function inRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= range.from && day <= range.to;
}

/** Every ISO day in the range, capped so long ranges stay cheap to render. */
export function eachDay(range: DateRange, cap = 800): string[] {
  const days = Math.min(rangeDays(range), cap);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(addDays(range.to, -i));
  return out;
}

/** Chooses day / week / month buckets so a chart never renders hundreds of points. */
export type Granularity = "day" | "week" | "month";

export function autoGranularity(range: DateRange): Granularity {
  const days = rangeDays(range);
  if (days <= 45) return "day";
  if (days <= 400) return "week";
  return "month";
}

export function bucketOf(iso: string, granularity: Granularity): string {
  if (granularity === "month") return `${iso.slice(0, 7)}-01`;
  if (granularity === "week") {
    const date = fromISO(iso);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return toISO(date);
  }
  return iso;
}

export function formatShort(iso: string): string {
  const date = fromISO(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatBucket(iso: string, granularity: Granularity): string {
  const date = fromISO(iso);
  if (granularity === "month") return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
