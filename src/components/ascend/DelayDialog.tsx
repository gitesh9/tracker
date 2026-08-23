import { useState } from "react";
import { DELAY_REASONS } from "@/lib/ascend/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function DelayDialog({
  open,
  taskTitle,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  taskTitle: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, notes: string) => void;
}) {
  const [reason, setReason] = useState<string>("low_energy");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why is this moving?</DialogTitle>
          <DialogDescription>
            “{taskTitle}” rolls into tomorrow. Naming the reason is how the pattern gets found.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {DELAY_REASONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                reason === r.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional detail — what actually got in the way?"
          rows={3}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(reason, notes);
              setNotes("");
              onOpenChange(false);
            }}
            style={{ backgroundImage: "var(--gradient-aurora)" }}
          >
            Log & carry forward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
