import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type DeferralLog = Database["public"]["Tables"]["deferral_logs"]["Row"];
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
export type FocusSession = Database["public"]["Tables"]["focus_sessions"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];

export type Domain = "focus" | "health" | "career" | "mindset";

export const DOMAINS: { key: Domain; label: string; token: string }[] = [
  { key: "focus", label: "Focus", token: "var(--domain-focus)" },
  { key: "health", label: "Health", token: "var(--domain-health)" },
  { key: "career", label: "Career", token: "var(--domain-career)" },
  { key: "mindset", label: "Mindset", token: "var(--domain-mindset)" },
];

export const DELAY_REASONS = [
  { key: "low_energy", label: "Low Energy" },
  { key: "scope_unclear", label: "Scope Unclear" },
  { key: "blocked", label: "Blocked" },
  { key: "distracted", label: "Distracted" },
  { key: "other", label: "Other" },
] as const;

export type TimeframeKey = "1d" | "1m" | "2m" | "1y" | "2y" | "all";

export const TIMEFRAMES: { key: TimeframeKey; label: string; days: number }[] = [
  { key: "1d", label: "1 Day", days: 1 },
  { key: "1m", label: "1 Month", days: 30 },
  { key: "2m", label: "2 Months", days: 60 },
  { key: "1y", label: "1 Year", days: 365 },
  { key: "2y", label: "2 Years", days: 730 },
  { key: "all", label: "All Time", days: 3650 },
];
