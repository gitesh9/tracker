import type { Database } from "./db-types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type DeferralLog = Database["public"]["Tables"]["deferral_logs"]["Row"];
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
export type FocusSession = Database["public"]["Tables"]["focus_sessions"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];

export type Domain =
  | "focus"
  | "health"
  | "career"
  | "mindset"
  | "finance"
  | "learning"
  | "creativity"
  | "relationships";

export interface DomainMeta {
  key: Domain;
  label: string;
  token: string;
  iconName: string;
  subtypes: string[];
}

export const DOMAINS: DomainMeta[] = [
  {
    key: "focus",
    label: "Focus",
    token: "var(--domain-focus)",
    iconName: "timer",
    subtypes: ["Deep Work", "Sprint", "Planning", "Declutter", "Admin"],
  },
  {
    key: "health",
    label: "Health",
    token: "var(--domain-health)",
    iconName: "heart",
    subtypes: ["Workout", "Nutrition", "Sleep", "Recovery", "Mobility", "Walk"],
  },
  {
    key: "career",
    label: "Career",
    token: "var(--domain-career)",
    iconName: "briefcase",
    subtypes: ["Execution", "Coding", "Networking", "Strategy", "Client Work", "Leadership"],
  },
  {
    key: "mindset",
    label: "Mindset",
    token: "var(--domain-mindset)",
    iconName: "brain",
    subtypes: ["Meditation", "Journaling", "Gratitude", "Breathwork", "Reflection"],
  },
  {
    key: "finance",
    label: "Finance",
    token: "var(--domain-finance)",
    iconName: "wallet",
    subtypes: ["Budgeting", "Investing", "Saving", "Expense Review", "Income Strategy"],
  },
  {
    key: "learning",
    label: "Learning",
    token: "var(--domain-learning)",
    iconName: "book",
    subtypes: ["Reading", "Course", "Language", "Research", "Skill Practice"],
  },
  {
    key: "creativity",
    label: "Creativity",
    token: "var(--domain-creativity)",
    iconName: "sparkles",
    subtypes: ["Writing", "Design", "Music", "Side Project", "Brainstorming"],
  },
  {
    key: "relationships",
    label: "Relationships",
    token: "var(--domain-relationships)",
    iconName: "activity",
    subtypes: ["Family", "Friends", "Mentorship", "Community", "Partner Check-in"],
  },
];

export const DOMAIN_TOKEN: Record<Domain, string> = {
  focus: "var(--domain-focus)",
  health: "var(--domain-health)",
  career: "var(--domain-career)",
  mindset: "var(--domain-mindset)",
  finance: "var(--domain-finance)",
  learning: "var(--domain-learning)",
  creativity: "var(--domain-creativity)",
  relationships: "var(--domain-relationships)",
};

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

export interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string;
  role: "leader" | "partner" | "member";
  currentStreak: number;
  todayCompletions: number;
  lastActive: string;
  cheersReceived: number;
}

export interface TeamGoal {
  id: string;
  squadId: string;
  title: string;
  domain: Domain;
  targetCount: number;
  currentCount: number;
  unit: string;
  deadline?: string;
  isCompleted: boolean;
  contributors: { memberId: string; name: string; count: number }[];
  createdAt: string;
}

export interface TeamTask {
  id: string;
  squadId: string;
  title: string;
  domain: Domain;
  assignedTo?: string; // memberId or "everyone"
  assignedName?: string;
  estimatedMinutes?: number;
  priority: "p1" | "p2" | "p3";
  dueDate?: string;
  isCompleted: boolean;
  completedBy?: string;
  completedAt?: string;
  createdAt: string;
}

export interface TeamSquad {
  id: string;
  name: string;
  description: string;
  code: string;
  createdAt: string;
  members: TeamMember[];
  goals: TeamGoal[];
  tasks: TeamTask[];
}
