import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { skillBranch, SKILL_TREE_VIEW, type treeSummary } from "@/lib/ascend/growth-tree";

type Summary = ReturnType<typeof treeSummary>;

export function GrowthTreeVisual({ summary }: { summary: Summary }) {
  const id = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const { branches, completions } = summary;
  const gradientId = `trunk-${id}`;
  const gold = completions >= 1000;
  const fruit = completions >= 900;
  const blossoms = completions >= 750;
  const trunkWidth = 30 + Math.min(1, completions / 600) * 6;

  return (
    <svg viewBox={`0 0 ${SKILL_TREE_VIEW.width} ${SKILL_TREE_VIEW.height}`} className="mx-auto block h-auto w-full max-w-xl" role="img"
      aria-label={`Skill tree, ${completions.toLocaleString()} season completions${gold ? ", golden tree" : fruit ? ", fruiting tree" : blossoms ? ", blossoming tree" : ""}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={gold ? "var(--tree-gold-base)" : "var(--tree-bark-base)"} />
          <stop offset="100%" stopColor={gold ? "var(--tree-gold-tip)" : "var(--tree-bark-tip)"} />
        </linearGradient>
        <filter id={`glow-${id}`} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <ellipse cx="240" cy="364" rx="130" ry="14" fill={gold ? "var(--tree-gold-tip)" : "var(--primary)"} opacity="0.08" />
      <motion.path d={`M${240 - trunkWidth / 2} 342 Q${240 - trunkWidth / 2} 357 240 357 Q${240 + trunkWidth / 2} 357 ${240 + trunkWidth / 2} 342 L246 104 Q240 92 234 104 Z`} fill={`url(#${gradientId})`}
        initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.4 }} />
      {branches.map((branch, i) => {
        const { baseY, endX, endY, nodeX, nodeY, labelX, labelY, size } = skillBranch(i, branch.count);
        const active = branch.count > 0;
        const delay = reduced ? 0 : i * 0.035;
        return (
          <g key={branch.key}>
            <title>{`${branch.label}: ${branch.count.toLocaleString()} completions`}</title>
            <text x={labelX} y={labelY} textAnchor="middle" fill="var(--muted-foreground)" fontSize="14" fontFamily="var(--font-sans)">{branch.label}</text>
            <motion.path d={`M240 ${baseY} Q${(240 + endX) / 2} ${(baseY + endY) / 2 + 4} ${endX} ${endY}`}
              stroke={`url(#${gradientId})`} strokeWidth={5 + size * 2} strokeLinecap="round" fill="none"
              initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 0.45, delay }} />
            {active && <g>
              <circle cx={nodeX} cy={nodeY} r="12" fill={branch.token} opacity="0.35" filter={`url(#glow-${id})`} />
              <circle cx={nodeX} cy={nodeY} r={6 + size * 3} fill={branch.token} />
              {blossoms && !fruit && Array.from({ length: 5 }, (_, p) => {
                const angle = p * Math.PI * 2 / 5;
                return <circle key={p} cx={endX + Math.cos(angle) * 5} cy={endY + Math.sin(angle) * 5} r="3.5" fill="var(--tree-blossom)" />;
              })}
              {fruit && <g>
                <path d={`M${endX} ${endY} v7`} stroke="var(--tree-bark-tip)" strokeWidth="2" />
                <circle cx={endX} cy={endY + 10} r="6" fill={gold ? "var(--tree-gold-tip)" : "var(--tree-fruit)"} />
              </g>}
            </g>}
          </g>
        );
      })}
    </svg>
  );
}
