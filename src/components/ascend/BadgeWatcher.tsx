import { useEffect, useState } from "react";
import { BadgeModal } from "./BadgeModal";
import { BADGES, earnedBadgeKeys, type Badge } from "@/lib/ascend/badges";
import {
  useAchievements,
  useFocusSessions,
  useGoals,
  useProfile,
  useSubtasks,
  useTasks,
  useUnlockAchievement,
} from "@/lib/ascend/queries";

/** Watches progress and celebrates newly earned badges once each. */
export function BadgeWatcher() {
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: subtasks = [] } = useSubtasks();
  const { data: sessions = [] } = useFocusSessions();
  const { data: achievements = [] } = useAchievements();
  const { data: profile } = useProfile();
  const unlock = useUnlockAchievement();
  const [queue, setQueue] = useState<Badge[]>([]);

  const unlockedKeys = achievements.map((a) => a.badge_key).join(",");

  useEffect(() => {
    const owned = new Set(unlockedKeys ? unlockedKeys.split(",") : []);
    const earned = earnedBadgeKeys({ tasks, goals, subtasks, sessions, profile });
    const fresh = earned.filter((key) => !owned.has(key));
    if (fresh.length === 0) return;
    fresh.forEach((key) => unlock.mutate(key));
    setQueue((q) => [
      ...q,
      ...BADGES.filter((b) => fresh.includes(b.key) && !q.some((x) => x.key === b.key)),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, goals, subtasks, sessions, profile, unlockedKeys]);

  return <BadgeModal badge={queue[0] ?? null} onClose={() => setQueue((q) => q.slice(1))} />;
}
