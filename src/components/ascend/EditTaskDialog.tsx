import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Clock3,
  Sparkles,
  Tag,
  Target,
  Zap,
  Plus,
  X,
  Loader2,
  Check,
  Link2,
  ListChecks,
} from "lucide-react";
import { DOMAINS, DOMAIN_TOKEN, type Domain, type Task } from "@/lib/ascend/types";
import { iconFor, ICON_KEYS } from "@/lib/ascend/icons";
import { getTaskCategories, getCategoryColor, getCategoryLabel } from "@/lib/ascend/categories";
import { suggestTaskRefinements } from "@/lib/ascend/ai.functions";
import { useTasks } from "@/lib/ascend/queries";
import { TaskSubtasks, useTaskSubtasks } from "./TaskSubtasks";
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

interface EditTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, patch: Partial<Task>) => void;
  goalOptions?: { id: string; title: string }[];
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  onSave,
  goalOptions = [],
}: EditTaskDialogProps) {
  const suggestRefineFn = useServerFn(suggestTaskRefinements);

  const [title, setTitle] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["focus"]);
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [frequencyType, setFrequencyType] = useState<string>("daily");
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(3);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState(25);
  const [priority, setPriority] = useState<string>("medium");
  const [energyLevel, setEnergyLevel] = useState<string>("medium");
  const [dueDate, setDueDate] = useState("");
  const [definitionOfDone, setDefinitionOfDone] = useState("");
  const [notes, setNotes] = useState("");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [iconName, setIconName] = useState("sparkles");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [linkQuery, setLinkQuery] = useState("");

  const { data: allTasks = [] } = useTasks();
  const { done: stepsDone, total: stepsTotal } = useTaskSubtasks(task?.id);

  const linkCandidates = allTasks.filter(
    (t) => t.id !== task?.id && t.title.toLowerCase().includes(linkQuery.trim().toLowerCase()),
  );
  const linkedTasks = linkedIds
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));

  const toggleLink = (id: string) => {
    setLinkedIds((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  };

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? "");
      const cats = getTaskCategories(task);
      setSelectedCategories(cats.length > 0 ? cats : [(task.domain as string) || "focus"]);
      setFrequencyType(task.frequency_type ?? "daily");
      setTargetDaysPerWeek(task.target_days_per_week ?? 3);
      setWeekdays(task.weekdays ?? []);
      setEstimatedMinutes(task.estimated_minutes ?? 25);
      setPriority(task.priority ?? "medium");
      setEnergyLevel(task.energy_level ?? "medium");
      setDueDate(task.due_date ?? "");
      setDefinitionOfDone(task.definition_of_done ?? "");
      setNotes(task.notes ?? "");
      setGoalId(task.goal_id ?? null);
      setIconName(task.icon_name ?? "sparkles");
      setShowIconPicker(false);
      setShowCustomInput(false);
      setNewCustomCategory("");
      setLinkedIds(task.linked_task_ids ?? []);
      setLinkQuery("");
    }
  }, [task, open]);

  const toggleCategory = (catKey: string) => {
    const norm = catKey.trim().toLowerCase();
    setSelectedCategories((prev) => {
      if (prev.includes(norm)) {
        if (prev.length === 1) {
          toast.info("A task must have at least one category.");
          return prev;
        }
        return prev.filter((c) => c !== norm);
      }
      return [...prev, norm];
    });
  };

  const handleAddCustomCategory = () => {
    const val = newCustomCategory.trim().toLowerCase();
    if (!val) return;
    if (!selectedCategories.includes(val)) {
      setSelectedCategories((prev) => [...prev, val]);
    }
    setNewCustomCategory("");
    setShowCustomInput(false);
  };

  const handleAiRefine = async () => {
    if (!title.trim() || isAiRefining) return;
    setIsAiRefining(true);
    try {
      const result = await suggestRefineFn({
        data: {
          rawTitle: title,
          notes,
          currentCategories: selectedCategories,
        },
      });

      if (result.title) setTitle(result.title);
      if (result.categories && result.categories.length > 0) {
        setSelectedCategories(result.categories.map((c) => c.toLowerCase()));
      }
      if (result.definitionOfDone) setDefinitionOfDone(result.definitionOfDone);
      if (result.estimatedMinutes) setEstimatedMinutes(result.estimatedMinutes);
      if (result.priority) setPriority(result.priority);
      if (result.energyLevel) setEnergyLevel(result.energyLevel);
      if (result.iconName) setIconName(result.iconName);

      toast.success("AI refined your task and categories!");
    } catch {
      toast.error("AI refinement unavailable. Keep editing manually.");
    } finally {
      setIsAiRefining(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim()) return;

    const primaryDomain = selectedCategories[0] || "focus";

    onSave(task.id, {
      title: title.trim(),
      domain: primaryDomain,
      categories: selectedCategories.length > 0 ? selectedCategories : [primaryDomain],
      frequency_type: frequencyType,
      target_days_per_week: frequencyType === "weekly_count" ? targetDaysPerWeek : 0,
      weekdays: frequencyType === "weekdays" ? weekdays : [],
      estimated_minutes: Number(estimatedMinutes) || 25,
      priority,
      energy_level: energyLevel,
      due_date: dueDate || task.due_date,
      definition_of_done: definitionOfDone.trim() || null,
      notes: notes.trim() || null,
      goal_id: goalId || null,
      icon_name: iconName,
      linked_task_ids: linkedIds,
    });
    onOpenChange(false);
  };

  const toggleWeekday = (dayIndex: number) => {
    setWeekdays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort(),
    );
  };

  const primaryCategory = selectedCategories[0] || "focus";
  const primaryColor = getCategoryColor(primaryCategory);
  const SelectedIcon = iconFor(iconName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <span
                className="flex size-7 items-center justify-center rounded-lg"
                style={{
                  background: `color-mix(in oklab, ${primaryColor} 20%, transparent)`,
                  color: primaryColor,
                }}
              >
                <SelectedIcon className="size-4" />
              </span>
              Edit Task
            </DialogTitle>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isAiRefining || !title.trim()}
              onClick={handleAiRefine}
              className="h-8 gap-1.5 text-xs text-primary border-primary/40 hover:bg-primary/10"
            >
              {isAiRefining ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5 text-accent" />
              )}
              AI Auto-Refine
            </Button>
          </div>
          <DialogDescription>
            Configure multi-categories, cadence, duration, priority, and success criteria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Title & Icon */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-title" className="text-xs font-semibold">
              Task Title
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                aria-label="Change icon"
              >
                <SelectedIcon className="size-5" style={{ color: primaryColor }} />
              </button>
              <Input
                id="edit-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Read 20 pages of architecture book"
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

          {/* Multiple Categories Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Tag className="size-3 text-primary" /> Task Categories (Select Multiple)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {selectedCategories.length} selected
              </span>
            </div>

            {/* Standard Category Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {DOMAINS.map((d) => {
                const isSelected = selectedCategories.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleCategory(d.key)}
                    className={cn(
                      "flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all text-left",
                      isSelected
                        ? "font-semibold shadow-xs"
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
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ background: d.token }}
                      />
                      <span className="truncate">{d.label}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Categories & Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {selectedCategories
                .filter((c) => !DOMAINS.some((d) => d.key === c))
                .map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium"
                    style={{
                      borderColor: getCategoryColor(c),
                      color: getCategoryColor(c),
                      background: `color-mix(in oklab, ${getCategoryColor(c)} 15%, transparent)`,
                    }}
                  >
                    #{getCategoryLabel(c)}
                    <button
                      type="button"
                      onClick={() => toggleCategory(c)}
                      className="hover:opacity-70"
                      aria-label={`Remove ${c}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}

              {showCustomInput ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newCustomCategory}
                    onChange={(e) => setNewCustomCategory(e.target.value)}
                    placeholder="Custom category name…"
                    className="h-7 w-36 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomCategory();
                      } else if (e.key === "Escape") {
                        setShowCustomInput(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleAddCustomCategory}
                    className="h-7 px-2 text-xs"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCustomInput(false)}
                    className="h-7 px-1 text-xs"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border/80 bg-surface/40 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  <Plus className="size-3" /> Add Custom Category
                </button>
              )}
            </div>
          </div>

          {/* Cadence / Frequency */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Frequency & Cadence</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: "daily", label: "Daily" },
                { key: "weekly_count", label: "Times/Wk" },
                { key: "weekdays", label: "Weekdays" },
                { key: "once", label: "Once" },
              ].map((freq) => (
                <button
                  key={freq.key}
                  type="button"
                  onClick={() => setFrequencyType(freq.key)}
                  className={cn(
                    "rounded-xl border py-1.5 text-xs font-medium transition-colors text-center",
                    frequencyType === freq.key
                      ? "border-primary bg-primary/15 text-primary font-semibold"
                      : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {freq.label}
                </button>
              ))}
            </div>

            {frequencyType === "weekly_count" && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-muted/30 p-2 text-xs">
                <Label htmlFor="target-days-input" className="text-muted-foreground">
                  Target times per week:
                </Label>
                <Input
                  id="target-days-input"
                  type="number"
                  min={1}
                  max={7}
                  value={targetDaysPerWeek}
                  onChange={(e) =>
                    setTargetDaysPerWeek(Math.min(7, Math.max(1, Number(e.target.value))))
                  }
                  className="h-8 w-20 text-center"
                />
              </div>
            )}

            {frequencyType === "weekdays" && (
              <div className="mt-2 flex gap-1 justify-between">
                {WEEKDAY_NAMES.map((name, idx) => {
                  const active = weekdays.includes(idx);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleWeekday(idx)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/20 text-primary font-bold"
                          : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground",
                      )}
                      aria-label={`Toggle ${name}`}
                    >
                      {name.slice(0, 2)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Duration & Priority & Energy Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Duration */}
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-task-duration"
                className="text-xs font-semibold flex items-center gap-1"
              >
                <Clock3 className="size-3 text-muted-foreground" /> Minutes
              </Label>
              <Input
                id="edit-task-duration"
                type="number"
                min={1}
                max={480}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="h-9"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-task-priority"
                className="text-xs font-semibold flex items-center gap-1"
              >
                <Zap className="size-3 text-warning" /> Priority
              </Label>
              <select
                id="edit-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-surface px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="high">P1 · High</option>
                <option value="medium">P2 · Medium</option>
                <option value="low">P3 · Low</option>
              </select>
            </div>

            {/* Energy */}
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-task-energy"
                className="text-xs font-semibold flex items-center gap-1"
              >
                <Sparkles className="size-3 text-accent" /> Energy
              </Label>
              <select
                id="edit-task-energy"
                value={energyLevel}
                onChange={(e) => setEnergyLevel(e.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-surface px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="high">High (Peak focus)</option>
                <option value="medium">Medium</option>
                <option value="low">Low (Light / Routine)</option>
              </select>
            </div>
          </div>

          {/* Goal Linkage & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-task-goal"
                className="text-xs font-semibold flex items-center gap-1"
              >
                <Target className="size-3 text-primary" /> Goal Link
              </Label>
              <select
                id="edit-task-goal"
                value={goalId ?? ""}
                onChange={(e) => setGoalId(e.target.value || null)}
                className="h-9 w-full rounded-xl border border-input bg-surface px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">No goal attached</option>
                {goalOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-task-due" className="text-xs font-semibold">
                Due Date
              </Label>
              <Input
                id="edit-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Definition of Done */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-dod" className="text-xs font-semibold">
              Definition of Done (Clear Success Criteria)
            </Label>
            <Input
              id="edit-task-dod"
              value={definitionOfDone}
              onChange={(e) => setDefinitionOfDone(e.target.value)}
              placeholder="e.g. 10 pullups logged, or summary notes written in Notion"
              className="text-xs"
            />
          </div>

          {/* Subtasks / steps */}
          {task && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <ListChecks className="size-3 text-primary" /> Steps (Subtasks)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {stepsTotal > 0 ? `${stepsDone}/${stepsTotal} done` : "None yet"}
                </span>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface/40 p-2">
                <TaskSubtasks taskId={task.id} accentColor={primaryColor} />
              </div>
            </div>
          )}

          {/* Linked tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Link2 className="size-3 text-primary" /> Linked Tasks
              </Label>
              <span className="text-[11px] text-muted-foreground">{linkedIds.length} linked</span>
            </div>

            {linkedTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {linkedTasks.map((lt) => (
                  <span
                    key={lt.id}
                    className="inline-flex max-w-[14rem] items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  >
                    <span className="truncate">{lt.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleLink(lt.id)}
                      aria-label={`Unlink ${lt.title}`}
                      className="hover:opacity-70 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Input
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Search tasks to link…"
              className="h-8 text-xs"
            />
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-surface/40 p-1.5">
              {linkCandidates.length === 0 && (
                <p className="px-1 py-1 text-xs text-muted-foreground">No other tasks found.</p>
              )}
              {linkCandidates.slice(0, 40).map((t) => {
                const on = linkedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleLink(t.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
                      on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border",
                        on ? "border-primary bg-primary/25" : "border-border",
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{t.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-notes" className="text-xs font-semibold">
              Notes & Context
            </Label>
            <Textarea
              id="edit-task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any helpful references, links, or constraints…"
              className="text-xs resize-none"
            />
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
