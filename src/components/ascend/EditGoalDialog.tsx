import { useEffect, useState } from "react";
import { Calendar, Sparkles, Target, Tag } from "lucide-react";
import { DOMAINS, DOMAIN_TOKEN, type Domain, type Goal } from "@/lib/ascend/types";
import { iconFor, ICON_KEYS } from "@/lib/ascend/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EditGoalDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (goalId: string, patch: Partial<Goal>) => void;
}

export function EditGoalDialog({ goal, open, onOpenChange, onSave }: EditGoalDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<Domain>("career");
  const [targetDays, setTargetDays] = useState(90);
  const [targetDate, setTargetDate] = useState("");
  const [iconName, setIconName] = useState("target");
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title ?? "");
      setDescription(goal.description ?? "");
      setDomain((goal.domain as Domain) || "career");
      setTargetDays(goal.target_days ?? 90);
      setTargetDate(goal.target_date ?? "");
      setIconName(goal.icon_name ?? "target");
      setShowIconPicker(false);
    }
  }, [goal, open]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal || !title.trim()) return;

    onSave(goal.id, {
      title: title.trim(),
      description: description.trim() || null,
      domain,
      target_days: Number(targetDays) || 90,
      target_date: targetDate || null,
      icon_name: iconName,
    });
    onOpenChange(false);
  };

  const currentDomainMeta = DOMAINS.find((d) => d.key === domain);
  const SelectedIcon = iconFor(iconName);
  const domainColor = DOMAIN_TOKEN[domain] ?? "var(--primary)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{
                background: `color-mix(in oklab, ${domainColor} 20%, transparent)`,
                color: domainColor,
              }}
            >
              <SelectedIcon className="size-4" />
            </span>
            Edit Long-Term Goal
          </DialogTitle>
          <DialogDescription>
            Fine-tune the objective, horizon, and domain for this goal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Title & Icon */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-goal-title" className="text-xs font-semibold">
              Goal Objective
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                aria-label="Change goal icon"
              >
                <SelectedIcon className="size-5" style={{ color: domainColor }} />
              </button>
              <Input
                id="edit-goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Build and launch SaaS v1"
                className="flex-1 font-medium"
                required
              />
            </div>

            {showIconPicker && (
              <div className="mt-2 rounded-xl border border-border bg-surface p-2.5 shadow-lg">
                <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Pick Icon</p>
                <div className="grid grid-cols-7 gap-1 max-h-36 overflow-y-auto pr-1">
                  {ICON_KEYS.map((key) => {
                    const IconComp = iconFor(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setIconName(key);
                          setShowIconPicker(false);
                        }}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg border transition-colors",
                          iconName === key
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        aria-label={`Select ${key} icon`}
                      >
                        <IconComp className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Domain / Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Domain</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {DOMAINS.map((d) => {
                const isSelected = domain === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDomain(d.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all text-left",
                      isSelected
                        ? "border-primary font-semibold"
                        : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground hover:border-border",
                    )}
                    style={
                      isSelected
                        ? {
                            background: `color-mix(in oklab, ${d.token} 18%, transparent)`,
                            color: d.token,
                            borderColor: d.token,
                          }
                        : undefined
                    }
                  >
                    <span className="size-2 rounded-full" style={{ background: d.token }} />
                    <span className="truncate">{d.label}</span>
                  </button>
                );
              })}
            </div>

            {currentDomainMeta && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
                  <Tag className="size-2.5" /> Subtypes:
                </span>
                {currentDomainMeta.subtypes.map((sub) => (
                  <span
                    key={sub}
                    className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description & Context */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-goal-description" className="text-xs font-semibold">
              Context / Success Definition
            </Label>
            <Textarea
              id="edit-goal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Why this goal matters and what success looks like…"
              className="text-xs resize-none"
            />
          </div>

          {/* Horizon & Target Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-goal-horizon"
                className="text-xs font-semibold flex items-center gap-1"
              >
                <Calendar className="size-3 text-primary" /> Target Horizon (Days)
              </Label>
              <div className="flex gap-1.5">
                {[30, 60, 90, 180, 365].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setTargetDays(days)}
                    className={cn(
                      "flex-1 rounded-lg border py-1 text-[11px] font-medium transition-colors",
                      targetDays === days
                        ? "border-primary bg-primary/20 text-primary font-bold"
                        : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <Input
                id="edit-goal-horizon"
                type="number"
                min={1}
                max={3650}
                value={targetDays}
                onChange={(e) => setTargetDays(Number(e.target.value))}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-goal-target-date" className="text-xs font-semibold">
                Target Completion Date (Optional)
              </Label>
              <Input
                id="edit-goal-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto font-semibold text-primary-foreground glow-button"
              style={{ backgroundImage: "var(--gradient-aurora)" }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
