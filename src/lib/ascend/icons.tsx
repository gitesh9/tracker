import {
  Activity,
  BookOpen,
  Brain,
  Briefcase,
  Code,
  Coffee,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Languages,
  Leaf,
  Lightbulb,
  Moon,
  Music,
  NotebookPen,
  PenLine,
  Rocket,
  Salad,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trophy,
  Wallet,
  Waves,
  type LucideIcon,
} from "lucide-react";

export const TASK_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  footprints: Footprints,
  heart: Heart,
  salad: Salad,
  droplets: Droplets,
  moon: Moon,
  sun: Sun,
  brain: Brain,
  book: BookOpen,
  pen: PenLine,
  notebook: NotebookPen,
  code: Code,
  briefcase: Briefcase,
  wallet: Wallet,
  rocket: Rocket,
  target: Target,
  trophy: Trophy,
  flame: Flame,
  timer: Timer,
  leaf: Leaf,
  waves: Waves,
  music: Music,
  coffee: Coffee,
  lightbulb: Lightbulb,
  languages: Languages,
  activity: Activity,
};

export const ICON_KEYS = Object.keys(TASK_ICONS);

export function iconFor(name: string | null | undefined): LucideIcon {
  return TASK_ICONS[name ?? "sparkles"] ?? Sparkles;
}

const KEYWORD_ICONS: [RegExp, string][] = [
  [/gym|workout|lift|train|gains/i, "dumbbell"],
  [/run|walk|steps|jog|cardio/i, "footprints"],
  [/water|hydrat|drink/i, "droplets"],
  [/eat|meal|diet|cook|salad|nutri/i, "salad"],
  [/sleep|bed|rest/i, "moon"],
  [/morning|wake|sunrise/i, "sun"],
  [/meditat|mindful|breath|calm|journal/i, "brain"],
  [/read|book|study|learn/i, "book"],
  [/write|blog|essay|note/i, "pen"],
  [/code|program|leetcode|dev|build/i, "code"],
  [/work|client|meeting|email|career|interview/i, "briefcase"],
  [/money|budget|save|invest|finance/i, "wallet"],
  [/launch|ship|startup|project/i, "rocket"],
  [/language|spanish|french|german|vocab/i, "languages"],
  [/music|guitar|piano|practice/i, "music"],
  [/focus|deep work|pomodoro/i, "timer"],
  [/health|doctor|vitamin/i, "heart"],
  [/idea|brainstorm|plan/i, "lightbulb"],
];

export function guessIcon(title: string): string {
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(title)) return icon;
  }
  return "sparkles";
}
