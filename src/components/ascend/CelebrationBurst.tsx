import { AnimatePresence, motion } from "motion/react";

const PARTICLES = Array.from({ length: 12 }, (_, i) => i);

export function CelebrationBurst({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {PARTICLES.map((i) => {
            const angle = (i / PARTICLES.length) * Math.PI * 2;
            const distance = 34 + (i % 3) * 10;
            return (
              <motion.span
                key={i}
                className="absolute size-1.5 rounded-full"
                style={{
                  background: i % 2 === 0 ? "var(--primary)" : "var(--primary-glow)",
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  opacity: 0,
                  scale: 0.3,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            );
          })}
          <motion.span
            className="absolute size-12 rounded-full"
            style={{ background: "var(--gradient-aurora)" }}
            initial={{ scale: 0.2, opacity: 0.5 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
