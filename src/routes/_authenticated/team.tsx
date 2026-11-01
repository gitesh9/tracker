import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Flame,
  LogIn,
  Plus,
  Shield,
  Sparkles,
  Target,
  UserPlus,
  Users2,
  X,
  Zap,
} from "lucide-react";
import {
  useAddTeamGoal,
  useAddTeamTask,
  useCheerTeammate,
  useLeaveSquad,
  useCreateSquad,
  useJoinSquad,
  useProfile,
  useSquads,
  useToggleTeamTask,
} from "@/lib/ascend/queries";
import { useAccount } from "@/lib/auth/use-account";
import { DOMAINS, type Domain } from "@/lib/ascend/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CelebrationBurst } from "@/components/ascend/CelebrationBurst";
import { cn } from "@/lib/utils";
import { formatLastActive } from "@/lib/squads/ops";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Team & Accountability Circles — Ascend" },
      {
        name: "description",
        content: "Collaborate on shared goals and tasks with real partner accountability circles.",
      },
      { property: "og:title", content: "Team & Accountability Circles — Ascend" },
      {
        property: "og:description",
        content: "Shared squad goals, team sprint tasks, and cheer boosts.",
      },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { data: authUser, isLoading: isAuthLoading } = useAccount();
  const { data: profile } = useProfile();
  const { data: squads = [], isLoading: isSquadsLoading } = useSquads();
  const createSquad = useCreateSquad();
  const joinSquad = useJoinSquad();
  const addTeamGoal = useAddTeamGoal();
  const addTeamTask = useAddTeamTask();
  const toggleTeamTask = useToggleTeamTask();
  const cheerTeammate = useCheerTeammate();
  const leaveSquad = useLeaveSquad();

  const [activeSquadId, setActiveSquadId] = useState<string>("");
  const squad = useMemo(
    () => squads.find((s) => s.id === activeSquadId) || squads[0] || null,
    [squads, activeSquadId],
  );

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [celebrationOrigin, setCelebrationOrigin] = useState<{ x: number; y: number } | null>(null);

  // Goal Form State
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDomain, setGoalDomain] = useState<Domain>("focus");
  const [goalTarget, setGoalTarget] = useState(20);
  const [goalUnit, setGoalUnit] = useState("tasks");
  const [goalDeadline, setGoalDeadline] = useState("");

  // Task Form State
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDomain, setTaskDomain] = useState<Domain>("career");
  const [taskAssignee, setTaskAssignee] = useState("everyone");
  const [taskPriority, setTaskPriority] = useState<"p1" | "p2" | "p3">("p1");
  const [taskMinutes, setTaskMinutes] = useState(30);

  // Squad Create / Join State
  const [newSquadName, setNewSquadName] = useState("");
  const [newSquadDesc, setNewSquadDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // Invite links (/team?join=CODE) open the join form already filled in.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join");
    if (!code) return;
    setJoinCode(code.toUpperCase());
    setShowJoinModal(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const handleCopyCode = async () => {
    if (!squad) return;
    const link = `${window.location.origin}/team?join=${encodeURIComponent(squad.code)}`;
    const text = `Join my Ascend squad "${squad.name}": ${link} (code ${squad.code})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${squad.name} on Ascend`, text, url: link });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Invite link copied — send it to your teammates.");
    } catch {
      /* share sheet dismissed */
    }
  };

  const handleLeave = () => {
    if (!squad) return;
    if (!window.confirm(`Leave "${squad.name}"? You can rejoin later with its invite code.`)) return;
    leaveSquad.mutate(squad.id, {
      onSuccess: () => {
        setActiveSquadId("");
        toast.success(`You left "${squad.name}".`);
      },
    });
  };

  const handleCreateSquad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadName.trim()) return;
    createSquad.mutate(
      { name: newSquadName.trim(), description: newSquadDesc.trim() },
      {
        onSuccess: (newSq) => {
          setActiveSquadId(newSq.id);
          setShowCreateModal(false);
          setNewSquadName("");
          setNewSquadDesc("");
          toast.success(`Created squad "${newSq.name}"!`);
        },
      },
    );
  };

  const handleJoinSquad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    joinSquad.mutate(joinCode.trim(), {
      onSuccess: (sq) => {
        setActiveSquadId(sq.id);
        setShowJoinModal(false);
        setJoinCode("");
        toast.success(`Successfully joined "${sq.name}"!`);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Could not join that squad.");
      },
    });
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!squad || !goalTitle.trim()) return;
    addTeamGoal.mutate(
      {
        squadId: squad.id,
        goal: {
          title: goalTitle.trim(),
          domain: goalDomain,
          targetCount: Number(goalTarget) || 10,
          currentCount: 0,
          unit: goalUnit.trim() || "tasks",
          ...(goalDeadline.trim() ? { deadline: goalDeadline.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          setShowGoalModal(false);
          setGoalTitle("");
          setGoalDeadline("");
          toast.success("Shared squad goal created!");
        },
      },
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!squad || !taskTitle.trim()) return;
    const assignedMember = squad.members.find((m) => m.id === taskAssignee);
    const assignedName =
      taskAssignee === "everyone" ? "Everyone" : assignedMember?.name || "Member";

    addTeamTask.mutate(
      {
        squadId: squad.id,
        task: {
          title: taskTitle.trim(),
          domain: taskDomain,
          assignedTo: taskAssignee,
          assignedName,
          priority: taskPriority,
          estimatedMinutes: Number(taskMinutes) || 30,
        },
      },
      {
        onSuccess: () => {
          setShowTaskModal(false);
          setTaskTitle("");
          toast.success("Shared team task added!");
        },
      },
    );
  };

  const handleToggleTask = (taskId: string, e: React.MouseEvent) => {
    if (!squad) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    toggleTeamTask.mutate(
      { squadId: squad.id, taskId },
      {
        onSuccess: (res) => {
          if (res?.isCompleted) {
            setCelebrationOrigin({ x, y });
            toast.success("Shared task completed! Teammates notified 🔥");
          }
        },
      },
    );
  };

  const handleCheer = (memberId: string, memberName: string) => {
    if (!squad) return;
    cheerTeammate.mutate(
      { squadId: squad.id, memberId },
      {
        onSuccess: (count) => {
          toast.success(`Sent cheer to ${memberName}! (${count} total cheers 🔥)`);
        },
      },
    );
  };

  // 1. Loading State
  if (isAuthLoading || isSquadsLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3 py-16 text-center">
        <div
          className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          role="status"
          aria-label="Loading team status"
        />
        <p className="text-sm text-muted-foreground">Loading accountability circles…</p>
      </div>
    );
  }

  // 2. Authentication Requirement Gate
  if (!authUser) {
    return (
      <div className="space-y-6">
        <header className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Users2 className="size-3.5" aria-hidden="true" />
            <span>Accountability Circles &amp; Teams</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            Squad Collaboration
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Collaborate on shared goals, hold partners accountable, and celebrate momentum together
            in real-time.
          </p>
        </header>

        <div className="glass-panel relative overflow-hidden rounded-2xl border border-border/80 p-6 sm:p-8 text-center space-y-6 shadow-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Shield className="size-8" aria-hidden="true" />
          </div>

          <div className="mx-auto max-w-md space-y-2">
            <h2 className="text-xl font-bold text-foreground">Sign In Required for Squads</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Team accountability and shared sprint boards require an Ascend account so your squad
              members can invite partners, synchronize progress across devices, and share milestones
              securely.
            </p>
          </div>

          <div className="mx-auto grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-border/60 bg-surface/60 p-3 space-y-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Target className="size-3.5 text-primary" aria-hidden="true" /> Shared Goals
              </span>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Track joint milestones and celebrate together.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface/60 p-3 space-y-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Flame className="size-3.5 text-warning" aria-hidden="true" /> Partner Cheers
              </span>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Boost teammates daily to keep streaks blazing.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface/60 p-3 space-y-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Zap className="size-3.5 text-primary" aria-hidden="true" /> Live Sync
              </span>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Instant collaboration across web and mobile.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              asChild
              className="h-11 px-8 font-semibold text-primary-foreground aurora-gradient-bg shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Link to="/auth">
                <LogIn className="mr-2 size-4" aria-hidden="true" />
                Sign in or Create Account
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated but No Squads Joined Yet
  if (!squad || squads.length === 0) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Accountability Circles
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Form or join a team squad to start climbing together.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowJoinModal(true)}
              className="h-9 text-xs font-medium"
            >
              <UserPlus className="mr-1.5 size-3.5 text-primary" aria-hidden="true" /> Join with
              Code
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="h-9 text-xs font-semibold text-primary-foreground aurora-gradient-bg"
            >
              <Plus className="mr-1.5 size-3.5" aria-hidden="true" /> Create Squad
            </Button>
          </div>
        </header>

        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/90 p-8 sm:p-12 text-center space-y-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users2 className="size-7" aria-hidden="true" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">No Squads Active Yet</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create an accountability circle for your coworkers, friends, or study partners, or
              enter an invite code to join an existing sprint squad.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="font-semibold text-primary-foreground aurora-gradient-bg"
            >
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Create First Squad
            </Button>
            <Button variant="outline" onClick={() => setShowJoinModal(true)}>
              <UserPlus className="mr-1.5 size-4" aria-hidden="true" />
              Join via Code
            </Button>
          </div>
        </div>

        {/* Modal: Create Squad */}
        {showCreateModal && renderCreateModal()}
        {/* Modal: Join Squad */}
        {showJoinModal && renderJoinModal()}
      </div>
    );
  }

  // 4. Authenticated with Active Squad
  return (
    <div className="space-y-6 sm:space-y-7">
      {celebrationOrigin && (
        <CelebrationBurst
          origin={celebrationOrigin}
          onComplete={() => setCelebrationOrigin(null)}
        />
      )}

      {/* Header & Squad Switcher */}
      <header className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {squad.name}
              </h1>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/30">
                {squad.members.length} {squad.members.length === 1 ? "Member" : "Members"}
              </span>
            </div>
            {squad.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{squad.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              aria-label={`Copy invite code ${squad.code}`}
              className="h-8 flex-1 sm:flex-initial text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Copy className="mr-1.5 size-3.5 text-primary" aria-hidden="true" /> Invite:{" "}
              {squad.code}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeave}
              aria-label={`Leave ${squad.name}`}
              className="h-8 text-xs text-muted-foreground"
            >
              Leave
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowJoinModal(true)}
              aria-label="Join another squad using code"
              className="h-8 flex-1 sm:flex-initial text-xs"
            >
              <UserPlus className="mr-1.5 size-3.5" aria-hidden="true" /> Join Code
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              aria-label="Create a new squad"
              className="h-8 w-full sm:w-auto text-xs font-semibold text-primary-foreground aurora-gradient-bg"
            >
              <Plus className="mr-1 size-3.5" aria-hidden="true" /> New Squad
            </Button>
          </div>
        </div>

        {/* Squad Pills if multiple */}
        {squads.length > 1 && (
          <nav
            aria-label="Squad selector"
            className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1 scroll-smooth"
          >
            {squads.map((sq) => (
              <button
                key={sq.id}
                type="button"
                onClick={() => setActiveSquadId(sq.id)}
                aria-pressed={sq.id === squad.id}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  sq.id === squad.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "border border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {sq.name}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Teammates & Accountability Board */}
      <section className="space-y-3" aria-labelledby="section-squad-members">
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="section-squad-members"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Squad Members &amp; Live Velocity
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Privacy-first: see real daily completions and streaks without exposing private task
              notes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
          {squad.members.map((member) => (
            <div
              key={member.id}
              className="glass-panel flex flex-col justify-between rounded-xl border border-border/60 p-3.5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate">
                      {member.name}
                    </span>
                    <span className="rounded bg-surface-raised px-1.5 py-0.2 text-[9px] uppercase font-semibold text-muted-foreground shrink-0">
                      {member.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Active: {formatLastActive(member.lastActive)}
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 text-xs font-bold text-amber-500 shrink-0"
                  aria-label={`${member.currentStreak} day streak`}
                >
                  <Flame className="size-3.5 fill-amber-500" aria-hidden="true" />
                  <span>{member.currentStreak}d</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{member.todayCompletions}</span>{" "}
                  completed today
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCheer(member.id, member.name)}
                  aria-label={`Send cheer to ${member.name}. Current cheers: ${member.cheersReceived}`}
                  className="h-7 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Flame className="mr-1 size-3 text-amber-500 fill-amber-500" aria-hidden="true" />
                  Cheer ({member.cheersReceived})
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Shared Squad Goals */}
      <section className="space-y-3" aria-labelledby="section-squad-goals">
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="section-squad-goals"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Shared Squad Goals
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Collective milestones with shared progress contributions.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowGoalModal(true)}
            aria-label="Add shared squad goal"
            className="h-8 text-xs font-semibold"
          >
            <Plus className="mr-1 size-3.5" aria-hidden="true" /> Add Shared Goal
          </Button>
        </div>

        {squad.goals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground space-y-2">
            <Target className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium text-foreground">No shared squad goals yet.</p>
            <p className="text-[11px]">
              Create a joint milestone like "50 shared focus sessions" to track together.
            </p>
            <Button size="sm" onClick={() => setShowGoalModal(true)}>
              Create First Shared Goal
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {squad.goals.map((g) => {
              const target = g.targetCount || 1;
              const current = g.currentCount || 0;
              const pct = Math.min(100, Math.round((current / target) * 100));
              return (
                <div
                  key={g.id}
                  className="glass-panel flex flex-col justify-between rounded-xl border border-border/60 p-4 space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold tracking-tight text-foreground">
                        {g.title}
                      </h3>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
                        {pct}%
                      </span>
                    </div>
                    {g.deadline && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Target: {g.deadline}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-semibold text-foreground">
                        {current} / {target} {g.unit}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={current}
                      aria-valuemin={0}
                      aria-valuemax={target}
                      aria-label={`${g.title} progress`}
                      className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500 aurora-gradient-bg"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Contributors */}
                  {g.contributors && g.contributors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">Contributors:</span>
                      {g.contributors.map((c, i) => (
                        <span
                          key={i}
                          className="rounded bg-surface-raised px-1.5 py-0.5 font-medium"
                        >
                          {c.name}: {c.count} {g.unit}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Shared Squad Tasks */}
      <section className="space-y-3" aria-labelledby="section-squad-tasks">
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="section-squad-tasks"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Shared Team Tasks &amp; Sprints
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Collaborative action items assigned to partners or the full squad.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowTaskModal(true)}
            aria-label="Add shared team task"
            className="h-8 text-xs font-semibold"
          >
            <Plus className="mr-1 size-3.5" aria-hidden="true" /> Add Team Task
          </Button>
        </div>

        {squad.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground space-y-2">
            <CheckCircle2 className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium text-foreground">No shared tasks on the board.</p>
            <p className="text-[11px]">
              Add shared action items that any teammate can pick up or complete.
            </p>
            <Button size="sm" onClick={() => setShowTaskModal(true)}>
              Add First Team Task
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {squad.tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "glass-panel flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3.5 transition-all",
                  task.isCompleted ? "opacity-60 bg-surface/30" : "hover:border-primary/40",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => handleToggleTask(task.id, e)}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                      task.isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary",
                    )}
                    aria-label={`Mark "${task.title}" as ${task.isCompleted ? "incomplete" : "complete"}`}
                  >
                    {task.isCompleted && (
                      <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-xs font-medium text-foreground truncate",
                        task.isCompleted && "line-through text-muted-foreground",
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-semibold text-primary">
                        Assigned: {task.assignedName || "Everyone"}
                      </span>
                      {task.estimatedMinutes && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="size-3" aria-hidden="true" /> {task.estimatedMinutes}m
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-semibold",
                          task.priority === "p1"
                            ? "bg-primary/15 text-primary"
                            : task.priority === "p2"
                              ? "bg-muted text-foreground"
                              : "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {task.priority === "p1"
                          ? "Critical"
                          : task.priority === "p2"
                            ? "Important"
                            : "Routine"}
                      </span>
                    </div>
                  </div>
                </div>

                {task.isCompleted && (
                  <span className="shrink-0 text-[10px] font-medium text-primary">
                    Done by {task.completedBy || "Squad"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      {showGoalModal && renderGoalModal()}
      {showTaskModal && renderTaskModal()}
      {showJoinModal && renderJoinModal()}
      {showCreateModal && renderCreateModal()}
    </div>
  );

  function renderGoalModal() {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-goal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      >
        <div className="glass-panel w-full max-w-md rounded-2xl p-5 space-y-4 border border-border shadow-xl">
          <div className="flex items-center justify-between">
            <h3 id="modal-goal-title" className="text-base font-semibold text-foreground">
              Add Shared Squad Goal
            </h3>
            <button
              type="button"
              onClick={() => setShowGoalModal(false)}
              aria-label="Close dialog"
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleAddGoal} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label htmlFor="goal-title-input" className="font-medium text-foreground">
                Goal Objective
              </Label>
              <Input
                id="goal-title-input"
                required
                placeholder="e.g. 50 Shared Deep Work Blocks"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="goal-target-input" className="font-medium text-foreground">
                  Target Count
                </Label>
                <Input
                  id="goal-target-input"
                  type="number"
                  min="1"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="goal-unit-input" className="font-medium text-foreground">
                  Unit
                </Label>
                <Input
                  id="goal-unit-input"
                  placeholder="hours, sessions, tasks"
                  value={goalUnit}
                  onChange={(e) => setGoalUnit(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="goal-domain-select" className="font-medium text-foreground">
                  Domain
                </Label>
                <select
                  id="goal-domain-select"
                  value={goalDomain}
                  onChange={(e) => setGoalDomain(e.target.value as Domain)}
                  className="h-9 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {DOMAINS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="goal-deadline-input" className="font-medium text-foreground">
                  Target Date / Horizon
                </Label>
                <Input
                  id="goal-deadline-input"
                  placeholder="e.g. End of Month"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowGoalModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-semibold text-primary-foreground aurora-gradient-bg"
              >
                Create Goal
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderTaskModal() {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-task-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      >
        <div className="glass-panel w-full max-w-md rounded-2xl p-5 space-y-4 border border-border shadow-xl">
          <div className="flex items-center justify-between">
            <h3 id="modal-task-title" className="text-base font-semibold text-foreground">
              Add Shared Team Task
            </h3>
            <button
              type="button"
              onClick={() => setShowTaskModal(false)}
              aria-label="Close dialog"
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleAddTask} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label htmlFor="task-title-input" className="font-medium text-foreground">
                Task Title
              </Label>
              <Input
                id="task-title-input"
                required
                placeholder="e.g. Sprint Sync & Retrospective"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="task-assignee-select" className="font-medium text-foreground">
                  Assignee
                </Label>
                <select
                  id="task-assignee-select"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="everyone">Everyone in Squad</option>
                  {squad?.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-priority-select" className="font-medium text-foreground">
                  Priority
                </Label>
                <select
                  id="task-priority-select"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as "p1" | "p2" | "p3")}
                  className="h-9 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="p1">P1 (Critical)</option>
                  <option value="p2">P2 (Important)</option>
                  <option value="p3">P3 (Routine)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="task-domain-select" className="font-medium text-foreground">
                  Domain
                </Label>
                <select
                  id="task-domain-select"
                  value={taskDomain}
                  onChange={(e) => setTaskDomain(e.target.value as Domain)}
                  className="h-9 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {DOMAINS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-minutes-input" className="font-medium text-foreground">
                  Estimated Minutes
                </Label>
                <Input
                  id="task-minutes-input"
                  type="number"
                  min="5"
                  step="5"
                  value={taskMinutes}
                  onChange={(e) => setTaskMinutes(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTaskModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-semibold text-primary-foreground aurora-gradient-bg"
              >
                Add Task
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderJoinModal() {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-join-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      >
        <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 border border-border shadow-xl">
          <div className="flex items-center justify-between">
            <h3 id="modal-join-title" className="text-base font-semibold text-foreground">
              Join Squad via Code
            </h3>
            <button
              type="button"
              onClick={() => setShowJoinModal(false)}
              aria-label="Close dialog"
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleJoinSquad} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label htmlFor="join-code-input" className="font-medium text-foreground">
                Squad Invite Code
              </Label>
              <Input
                id="join-code-input"
                required
                placeholder="e.g. SQUAD-7KQ2M9XA"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="h-9 uppercase tracking-widest text-xs font-mono font-bold"
              />
              <p className="text-[10px] text-muted-foreground">
                Ask a squad member for their invite link or code.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowJoinModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-semibold text-primary-foreground aurora-gradient-bg"
              >
                Join Squad
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderCreateModal() {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-create-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      >
        <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 border border-border shadow-xl">
          <div className="flex items-center justify-between">
            <h3 id="modal-create-title" className="text-base font-semibold text-foreground">
              Create New Squad
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              aria-label="Close dialog"
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleCreateSquad} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label htmlFor="create-squad-name" className="font-medium text-foreground">
                Squad Name
              </Label>
              <Input
                id="create-squad-name"
                required
                placeholder="e.g. 🌅 5AM Deep Work Sprint"
                value={newSquadName}
                onChange={(e) => setNewSquadName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-squad-desc" className="font-medium text-foreground">
                Description / Purpose
              </Label>
              <Input
                id="create-squad-desc"
                placeholder="e.g. Daily sprint velocity & partner accountability."
                value={newSquadDesc}
                onChange={(e) => setNewSquadDesc(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-semibold text-primary-foreground aurora-gradient-bg"
              >
                Create Squad
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
