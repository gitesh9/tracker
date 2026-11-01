import { cn } from "@/lib/utils";

export function PageLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading Ascend" className={cn("mx-auto w-full max-w-3xl space-y-6 px-4 py-8", fullScreen && "min-h-dvh bg-background sm:py-16")}>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 font-display font-semibold text-primary">A</span>
        <span className="text-sm font-medium text-muted-foreground">Loading Ascend…</span>
      </div>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-4 w-56 max-w-full rounded bg-muted/60" />
        <div className="grid gap-3 pt-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-lg border border-border bg-surface" />)}
        </div>
      </div>
    </div>
  );
}