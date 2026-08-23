import { useMemo } from "react";
import { addDays, fromISO, todayISO } from "@/lib/ascend/cadence";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Heatmap({ counts, weeks = 26 }: { counts: Record<string, number>; weeks?: number }) {
  const days = useMemo(() => {
    const total = weeks * 7;
    const end = todayISO();
    const start = addDays(end, -(total - 1));
    const list: string[] = [];
    for (let i = 0; i < total; i++) list.push(addDays(start, i));
    return list;
  }, [weeks]);

  const max = Math.max(1, ...Object.values(counts));

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {chunk(days, 7).map((week, i) => (
          <div key={i} className="flex flex-col gap-1">
            {week.map((day) => {
              const count = counts[day] ?? 0;
              const intensity = count === 0 ? 0 : 0.25 + (count / max) * 0.75;
              return (
                <Tooltip key={day}>
                  <TooltipTrigger asChild>
                    <div
                      className="size-3 rounded-[3px] transition-transform hover:scale-125"
                      style={{
                        background:
                          count === 0
                            ? "color-mix(in oklab, var(--muted) 60%, transparent)"
                            : `color-mix(in oklab, var(--primary) ${intensity * 100}%, transparent)`,
                        boxShadow:
                          count > 0
                            ? `0 0 ${6 * intensity}px color-mix(in oklab, var(--primary) 60%, transparent)`
                            : "none",
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="text-xs">
                      {count} completed ·{" "}
                      {fromISO(day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
