import { useEffect, useRef, useState } from "react";
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

const CELEBRATED_KEY = "ascend.badges.celebrated.v1";

/** Badges already shown on this device — persisted so a badge pops up exactly once,
 *  even when the unlock can't be saved (e.g. signed out) or the app restarts. */
function readCelebrated(): Set<string> {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

function writeCelebrated(keys: Set<string>) {
  try {
    localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...keys]));
  } catch {
    // storage full/blocked — the in-memory set still covers this session
  }
}

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
  const celebrated = useRef<Set<string> | null>(null);
  if (celebrated.current === null) {
    celebrated.current =
      typeof window === "undefined" ? new Set<string>() : readCelebrated();
  }

  const unlockedKeys = achievements.map((a) => a.badge_key).join(",");

  useEffect(() => {
    const owned = new Set(unlockedKeys ? unlockedKeys.split(",") : []);
    const earned = earnedBadgeKeys({ tasks, goals, subtasks, sessions, profile });
    const seen = celebrated.current ?? new Set<string>();
    const fresh = earned.filter((key) => !owned.has(key) && !seen.has(key));
    if (fresh.length === 0) return;
    fresh.forEach((key) => {
      seen.add(key);
      unlock.mutate(key);
    });
    celebrated.current = seen;
    writeCelebrated(seen);
    setQueue((q) => {
      const have = new Set(q.map((b) => b.key));
      return [...q, ...BADGES.filter((b) => fresh.includes(b.key) && !have.has(b.key))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, goals, subtasks, sessions, profile, unlockedKeys]);

  const current = queue[0] ?? null;
  // Close by key so a double close event (button + dialog) can't skip or re-show badges.
  const close = () => {
    if (!current) return;
    const key = current.key;
    setQueue((q) => q.filter((b) => b.key !== key));
  };

  return <BadgeModal key={current?.key ?? "none"} badge={current} onClose={close} />;
}
