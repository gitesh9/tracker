import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOMAINS } from "@/lib/ascend/types";
import { useCreateTask } from "@/lib/ascend/queries";
import { loadDemoData } from "@/lib/ascend/demo";
import { cn } from "@/lib/utils";

const KEY = "ascend.welcome.done.v1";

/** First-open guide: shown once per device, only while there are no tasks. */
export function WelcomeDialog({ hasTasks }: { hasTasks: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [areas, setAreas] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const createTask = useCreateTask();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!hasTasks && !window.localStorage.getItem(KEY)) setOpen(true);
  }, [hasTasks]);

  function finish() {
    window.localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  function addFirst() {
    const t = title.trim();
    if (!t) return;
    const domain = areas[0] ?? "focus";
    createTask.mutate({ title: t, domain, categories: [domain] });
    setStep(2);
  }

  async function sample() {
    await loadDemoData();
    await qc.invalidateQueries();
    finish();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {step + 1} of 3</p>
        {step === 0 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Where do you want to grow?</DialogTitle>
              <DialogDescription>Pick a few areas. Each becomes a branch on your growth tree.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map((d) => {
                const on = areas.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAreas((a) => (on ? a.filter((x) => x !== d.key) : [...a, d.key]))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={sample}>Explore with sample data</Button>
              <Button onClick={() => setStep(1)}>Next</Button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Add your first task</DialogTitle>
              <DialogDescription>Keep it small. Try “read 10 pages” or “walk 20 min”.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addFirst();
              }}
              className="space-y-3"
            >
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My first small step" />
              <div className="flex justify-between gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button type="submit" disabled={!title.trim()}>Add task</Button>
              </div>
            </form>
          </>
        )}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Now watch it grow</DialogTitle>
              <DialogDescription>
                Tick the task when it's done and a branch sprouts on your growth tree.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  finish();
                  void navigate({ to: "/tree" });
                }}
              >
                See my tree
              </Button>
              <Button onClick={finish}>Start climbing</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
