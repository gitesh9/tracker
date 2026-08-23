import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Mountain, Sparkles, Target, Timer } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
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
  { icon: Sparkles, title: "Quick capture", body: "Type “gym 3x per week 45 min” and it becomes a real cadence." },
  { icon: Target, title: "Goals that split", body: "Long-term goals break into milestones with a projected finish." },
  { icon: Timer, title: "Focus that counts", body: "Pomodoro, deep work and sprints — logged automatically." },
];

function Landing() {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="aurora-backdrop" aria-hidden />
      <main className="relative mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex size-14 items-center justify-center rounded-2xl"
          style={{ backgroundImage: "var(--gradient-aurora)" }}
        >
          <Mountain className="size-7 text-primary-foreground" />
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-7 font-display text-5xl font-semibold tracking-tight"
        >
          One small <span className="aurora-text">ascent</span>
          <br />
          every single day.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-5 max-w-md text-balance text-muted-foreground"
        >
          Ascend keeps your habits, goals and focus in one quiet place — and tells you the truth about
          why things slip.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-8"
        >
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-full px-8 py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            style={{ backgroundImage: "var(--gradient-aurora)", boxShadow: "var(--shadow-glow)" }}
          >
            Start climbing
          </Link>
        </motion.div>

        <div className="mt-16 grid w-full gap-3 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08 }}
              className="glass-panel rounded-2xl p-5 text-left"
            >
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
