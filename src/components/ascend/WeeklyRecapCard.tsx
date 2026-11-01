import { useMemo, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/lib/ascend/types";
import { DOMAINS } from "@/lib/ascend/types";
import { todayISO, fromISO } from "@/lib/ascend/cadence";
import { weeklyRecap } from "@/lib/ascend/recap";
import { Button } from "@/components/ui/button";

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  fromISO(iso).toLocaleDateString(undefined, opts);

export function WeeklyRecapCard({ tasks }: { tasks: Task[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const r = useMemo(() => weeklyRecap(tasks, todayISO()), [tasks]);
  const top = DOMAINS.find((d) => d.key === r.topDomain);
  const max = Math.max(1, ...Object.values(r.perDomain));

  async function share() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const url = await (await import("html-to-image")).toPng(ref.current, { pixelRatio: 2, backgroundColor: bg });
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "ascend-week.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My week on Ascend" });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = "ascend-week.png";
        a.click();
      }
    } catch {
      toast.error("Couldn't create the image — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <div ref={ref} className="glass-panel rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your week · {fmt(r.start, { month: "short", day: "numeric" })} – {fmt(r.end, { month: "short", day: "numeric" })}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums">{r.completions}</p>
            <p className="text-xs text-muted-foreground">tasks done</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums">{r.activeDays}/7</p>
            <p className="text-xs text-muted-foreground">days active</p>
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold" style={{ color: top?.token }}>
              {top?.label ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              strongest area{r.bestDay ? ` · best day ${fmt(r.bestDay, { weekday: "short" })}` : ""}
            </p>
          </div>
        </div>
        {r.completions > 0 && (
          <ul className="mt-4 space-y-1.5">
            {DOMAINS.filter((d) => r.perDomain[d.key]).map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-muted-foreground">{d.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(r.perDomain[d.key]! / max) * 100}%`, background: d.token }}
                  />
                </span>
                <span className="w-6 text-right tabular-nums">{r.perDomain[d.key]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[10px] text-muted-foreground">Ascend — one small ascent every day</p>
      </div>
      <Button size="sm" variant="outline" className="rounded-full" onClick={share} disabled={busy}>
        <Share2 className="size-3.5" /> {busy ? "Preparing…" : "Share my week"}
      </Button>
    </section>
  );
}
