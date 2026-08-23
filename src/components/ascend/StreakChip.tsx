import { motion } from "motion/react";
import { Flame, Snowflake } from "lucide-react";

export function StreakChip({ streak, freezes }: { streak: number; freezes: number }) {
  return (
    <div className="glass-panel flex items-center gap-3 rounded-full px-4 py-2">
      <motion.span
        className="flex items-center gap-1.5 text-sm font-semibold"
        animate={streak > 0 ? { scale: [1, 1.08, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
      >
        <Flame
          className="size-4"
          style={{
            color: streak > 0 ? "var(--warning)" : "var(--muted-foreground)",
            filter: streak > 0 ? "drop-shadow(0 0 8px color-mix(in oklab, var(--warning) 70%, transparent))" : "none",
          }}
        />
        {streak}
      </motion.span>
      <span className="h-4 w-px bg-border" />
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Snowflake className="size-4 text-primary" />
        {freezes}
      </span>
    </div>
  );
}
