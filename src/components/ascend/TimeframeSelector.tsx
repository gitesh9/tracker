import { motion } from "motion/react";
import { TIMEFRAMES, type TimeframeKey } from "@/lib/ascend/types";
import { cn } from "@/lib/utils";

export function TimeframeSelector({
  value,
  onChange,
}: {
  value: TimeframeKey;
  onChange: (key: TimeframeKey) => void;
}) {
  return (
    <div className="glass-panel no-scrollbar flex w-full gap-1 overflow-x-auto rounded-full p-1 scroll-smooth">
      {TIMEFRAMES.map((tf) => {
        const active = tf.key === value;
        return (
          <button
            key={tf.key}
            onClick={() => onChange(tf.key)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="timeframe-pill"
                className="absolute inset-0 rounded-full"
                style={{ backgroundImage: "var(--gradient-aurora)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{tf.label}</span>
          </button>
        );
      })}
    </div>
  );
}
