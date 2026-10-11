import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  LayoutGrid,
  Settings,
  Target,
  Timer,
  TreePine,
  Trophy,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeWatcher } from "@/components/ascend/BadgeWatcher";
import { SyncWatcher } from "@/components/ascend/SyncWatcher";
import { AccountChip } from "@/components/ascend/AccountChip";
import { hydrateLocalStore } from "@/lib/ascend/local-store";
import { getAuthSessionUser, useReminders } from "@/lib/ascend/queries";
import { runReminderTick } from "@/lib/ascend/notifications";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Load this device's data into memory once, before any screen reads it.
    // Do not open an empty task cache while durable history is still loading.
    await hydrateLocalStore();
    const user = await getAuthSessionUser();
    return { user };
  },
  component: AppShell,
});

type Destination = {
  to: string;
  label: string;
  icon: typeof CheckCircle2;
  hint: string;
};

/** Every destination in the product. Nothing here is ever hidden — the mobile
 *  bar shows the five daily ones and "More" opens the rest as a labelled sheet;
 *  desktop shows all of them inline. */
const PRIMARY: Destination[] = [
  { to: "/today", label: "Today", icon: CheckCircle2, hint: "Your daily log and timetable" },
  { to: "/goals", label: "Goals", icon: Target, hint: "Milestones and breakdowns" },
  { to: "/focus", label: "Focus", icon: Timer, hint: "Timers, loops and soundscapes" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, hint: "Month view and weekly review" },
  { to: "/insights", label: "Insights", icon: BarChart3, hint: "Trends across any date range" },
];

const SECONDARY: Destination[] = [
  { to: "/tree", label: "Growth Tree", icon: TreePine, hint: "Your progress, visualised" },
  { to: "/team", label: "Squad Circles", icon: Users2, hint: "Shared goals and accountability" },
  { to: "/achieved", label: "Achieved", icon: Trophy, hint: "Retrospectives and badges" },
  { to: "/settings", label: "Settings", icon: Settings, hint: "AI, reminders, streaks, install" },
];

const ALL = [...PRIMARY, ...SECONDARY];

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

function ReminderTicker() {
  const { data: reminders = [] } = useReminders();
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;

  useEffect(() => {
    runReminderTick(remindersRef.current);
    const id = window.setInterval(() => runReminderTick(remindersRef.current), 15_000);

    const onWake = () => {
      runReminderTick(remindersRef.current);
    };

    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, []);

  return null;
}

function MoreSheet({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const active = SECONDARY.some((d) => isActive(pathname, d.to));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          "relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="More sections"
      >
        {active && <span className="absolute inset-0 rounded-xl bg-primary/12" />}
        <LayoutGrid className="relative z-10 size-5 shrink-0" />
        <span className="relative z-10">More</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-border/70 pb-8">
        <SheetHeader className="px-1 text-left">
          <SheetTitle className="font-display text-lg">Everything else</SheetTitle>
        </SheetHeader>
        <nav className="mt-2 grid gap-2">
          {SECONDARY.map((d) => {
            const Icon = d.icon;
            const current = isActive(pathname, d.to);
            return (
              <Link
                key={d.to}
                to={d.to}
                preload="intent"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/60 bg-surface/50 hover:border-primary/30 hover:bg-surface",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    current ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      current ? "text-primary" : "text-foreground",
                    )}
                  >
                    {d.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{d.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/** Fades a page in the first time it is opened. Pages already visited in this session
 *  render straight away, so returning to them never replays the entrance animation. */
function PageTransition({ pathname, children }: { pathname: string; children: ReactNode }) {
  const visited = useRef<Set<string>>(new Set());
  const isFirstVisit = !visited.current.has(pathname);

  useEffect(() => {
    visited.current.add(pathname);
  }, [pathname]);

  return (
    <motion.div
      key={pathname}
      initial={isFirstVisit ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="relative min-h-dvh w-full max-w-full overflow-x-hidden bg-background">
      <div className="aurora-backdrop" aria-hidden />
      <BadgeWatcher />
      <SyncWatcher />
      <ReminderTicker />

      <header className="relative z-30 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            to="/today"
            className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ascend home"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg aurora-gradient-bg text-[13px] font-bold text-primary-foreground">
              A
            </span>
            <span className="truncate font-display text-base font-semibold tracking-tight text-foreground">
              Ascend
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <AccountChip />
            <Link
              to="/settings"
              preload="intent"
              aria-label="Settings"
              className={cn(
                "grid size-9 place-items-center rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive(pathname, "/settings")
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Settings className="size-[18px]" />
            </Link>
          </div>
        </div>

        {/* Desktop: every destination inline, nothing behind a menu. */}
        <nav
          aria-label="Sections"
          className="mx-auto hidden w-full max-w-5xl gap-1 overflow-x-auto px-6 pb-2 no-scrollbar md:flex"
        >
          {ALL.map((d) => {
            const Icon = d.icon;
            const active = isActive(pathname, d.to);
            return (
              <Link
                key={d.to}
                to={d.to}
                preload="intent"
                title={d.hint}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="desktop-nav-active"
                    className="absolute inset-0 rounded-full bg-primary/12"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <Icon className="relative z-10 size-4" />
                <span className="relative z-10">{d.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="relative mx-auto w-full max-w-3xl px-3 pb-28 pt-4 sm:px-6 md:pb-12 transform-gpu">
        <PageTransition pathname={pathname}>
          <Outlet />
        </PageTransition>
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transform-gpu md:hidden"
      >
        <div className="glass-panel mx-auto flex max-w-lg items-center justify-between rounded-2xl p-1 shadow-lg">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                className={cn(
                  "relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors select-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-primary/12"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <Icon className="relative z-10 size-5 shrink-0" />
                <span className="relative z-10 truncate max-w-full text-center">{item.label}</span>
              </Link>
            );
          })}
          <MoreSheet pathname={pathname} />
        </div>
      </nav>
    </div>
  );
}
