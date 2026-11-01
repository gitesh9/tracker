import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  BarChart3,
  BellRing,
  Mountain,
  RefreshCw,
  Sparkles,
  Sprout,
  Target,
  Timer,
  WifiOff,
} from "lucide-react";
import { getDb } from "@/lib/db/pglite";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { clearDemoData, isDemoActive, loadDemoData } from "@/lib/ascend/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://stellar-mind-journal.lovable.app/og-image.jpg" },
      { name: "twitter:image", content: "https://stellar-mind-journal.lovable.app/og-image.jpg" },
      { title: "Ascend — Daily Personal Growth Tracker" },
      {
        name: "description",
        content:
          "Ascend turns habits, goals and focus sessions into one calm daily climb — with streaks, a growth tree and honest insight into why things slip.",
      },
      { property: "og:title", content: "Ascend — Daily Personal Growth Tracker" },
      {
        property: "og:description",
        content: "Habits, goals, focus and insight in one calm daily ritual.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Sparkles,
    title: "Quick capture",
    body: "Type “gym 3x per week 45 min” and it becomes a real cadence.",
  },
  {
    icon: Target,
    title: "Goals that split",
    body: "Long-term goals break into milestones with a projected finish.",
  },
  {
    icon: Timer,
    title: "Focus that counts",
    body: "Pomodoro, deep work and sprints — logged automatically.",
  },
  {
    icon: Sprout,
    title: "A growth tree",
    body: "Every finished task grows a branch of the area of life it belongs to.",
  },
  {
    icon: BarChart3,
    title: "Honest insight",
    body: "See your strongest hours, streaks and the real reasons tasks slip.",
  },
  {
    icon: BellRing,
    title: "Gentle reminders",
    body: "Nudges that arrive on your phone or desktop, even with the app closed.",
  },
];

const PROMISES = [
  { icon: WifiOff, label: "Works fully offline" },
  { icon: RefreshCw, label: "Syncs across your devices" },
  { icon: Mountain, label: "Installs like a native app" },
];

function Landing() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Warm up the /today route chunk and local PGlite database in the background
    const timer = setTimeout(() => {
      void router.preloadRoute({ to: "/today" }).catch(() => {});
      void getDb().catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="relative min-h-screen bg-background" suppressHydrationWarning>
      <div className="aurora-backdrop" aria-hidden />
      <main
        className="relative mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center"
        suppressHydrationWarning
      >
        <span
          className="flex size-14 items-center justify-center rounded-2xl aurora-gradient-bg transition-transform duration-500"
          style={{
            transform: mounted ? "scale(1)" : "scale(0.85)",
            opacity: mounted ? 1 : 0.8,
          }}
          suppressHydrationWarning
        >
          <Mountain suppressHydrationWarning className="size-7 text-primary-foreground" />
        </span>

        <h1
          className="mt-7 font-display text-5xl font-semibold tracking-tight transition-all duration-500"
          style={{
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            opacity: mounted ? 1 : 0.8,
          }}
          suppressHydrationWarning
        >
          One small{" "}
          <span className="aurora-text" suppressHydrationWarning>
            ascent
          </span>
          <br />
          every single day.
        </h1>

        <p
          className="mt-5 max-w-md text-balance text-muted-foreground transition-all duration-500 delay-75"
          style={{
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            opacity: mounted ? 1 : 0.8,
          }}
          suppressHydrationWarning
        >
          Ascend keeps your habits, goals and focus in one quiet place — and tells you the truth
          about why things slip.
        </p>

        <div
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row transition-all duration-500 delay-150"
          style={{
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            opacity: mounted ? 1 : 0.8,
          }}
          suppressHydrationWarning
        >
          <Link
            to="/today"
            preload="intent"
            className="glow-button inline-flex items-center justify-center rounded-full px-8 py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            suppressHydrationWarning
          >
            Start climbing
          </Link>
          <Link
            to="/auth"
            preload="intent"
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface/50 px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            suppressHydrationWarning
          >
            Sign in / Sync
          </Link>
        </div>
        <DemoButton />


        <div className="mt-16 grid w-full gap-3 sm:grid-cols-3" suppressHydrationWarning>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="glass-panel rounded-2xl p-5 text-left transition-all duration-500"
              style={{
                transform: mounted ? "translateY(0)" : "translateY(16px)",
                opacity: mounted ? 1 : 0.8,
                transitionDelay: `${200 + i * 80}ms`,
              }}
              suppressHydrationWarning
            >
              <f.icon suppressHydrationWarning className="size-5 text-primary" />
              <h2 className="mt-3 font-display font-semibold" suppressHydrationWarning>
                {f.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
                {f.body}
              </p>
            </div>
          ))}
        </div>
        <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {PROMISES.map((p) => (
            <li key={p.label} className="flex items-center gap-1.5">
              <p.icon className="size-3.5 text-primary" aria-hidden />
              {p.label}
            </li>
          ))}
        </ul>
      </main>
      <footer className="relative space-y-1 pb-10 text-center text-xs text-muted-foreground">
        <p>Ascend — a calm place for the daily climb.</p>
        <p>
          Built by Gitesh Wankhede ·{" "}
          <a className="underline hover:text-foreground" href="https://github.com/" target="_blank" rel="noreferrer">
            GitHub
          </a>{" "}
          ·{" "}
          <a className="underline hover:text-foreground" href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </p>
      </footer>
    </div>
  );
}

function DemoButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setActive(isDemoActive()), []);

  async function onClick() {
    setBusy(true);
    try {
      if (active) {
        await clearDemoData();
        setActive(false);
        await queryClient.invalidateQueries();
      } else {
        await loadDemoData();
        await queryClient.invalidateQueries();
        await navigate({ to: "/today" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
    >
      {busy ? "One moment…" : active ? "Clear sample data" : "Try with sample data"}
    </button>
  );
}
