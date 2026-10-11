import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

const PARTICLES = Array.from({ length: 12 }, (_, i) => i);

type BurstProps = {
  /** Inline burst inside a positioned parent. */
  active?: boolean;
  /** Viewport coordinates for a one-shot burst rendered above the page. */
  origin?: { x: number; y: number };
  onComplete?: () => void;
};

export function CelebrationBurst({ active, origin, onComplete }: BurstProps) {
  const visible = origin ? true : Boolean(active);

  useEffect(() => {
    if (!origin || !onComplete) return;
    const id = window.setTimeout(onComplete, 800);
    return () => window.clearTimeout(id);
  }, [origin, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <div
          aria-hidden
          className={
            origin
              ? "pointer-events-none fixed z-50 flex items-center justify-center"
              : "pointer-events-none absolute inset-0 flex items-center justify-center"
          }
          {...(origin ? { style: { left: origin.x, top: origin.y } } : {})}
        >
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
