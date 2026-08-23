import { useEffect } from "react";
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { BarChart3, CalendarDays, CheckCircle2, Settings, Target, Timer, TreePine, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BadgeWatcher } from "@/components/ascend/BadgeWatcher";
import { SyncWatcher } from "@/components/ascend/SyncWatcher";
import { useReminders } from "@/lib/ascend/queries";
import { runReminderTick } from "@/lib/ascend/notifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

const NAV = [
  { to: "/today", label: "Today", icon: CheckCircle2 },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/tree", label: "Tree", icon: TreePine },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/achieved", label: "Achieved", icon: Trophy },
] as const;

function ReminderTicker() {
  const { data: reminders = [] } = useReminders();
  useEffect(() => {
    runReminderTick(reminders);
    const id = window.setInterval(() => runReminderTick(reminders), 60_000);
    return () => window.clearInterval(id);
  }, [reminders]);
  return null;
}

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="relative min-h-screen bg-background">
      <div className="aurora-backdrop" aria-hidden />
      <BadgeWatcher />
      <SyncWatcher />
      <ReminderTicker />
      <div className="relative mx-auto flex w-full max-w-3xl justify-end px-4 pt-4 sm:px-6">
        <Link
          to="/settings"
          aria-label="Settings"
          className={cn(
            "rounded-full p-2 transition-colors",
            pathname.startsWith("/settings")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings className="size-5" />
        </Link>
      </div>
      <main className="relative mx-auto w-full max-w-3xl px-4 pb-28 pt-2 sm:px-6">
        <Outlet />
      </main>


      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass-panel mx-auto flex max-w-md items-center justify-between rounded-2xl p-1.5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-primary/12"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon className="relative z-10 size-5" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
