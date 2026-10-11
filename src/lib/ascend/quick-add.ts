import { guessIcon } from "./icons";
import { addDays, todayISO, toISO } from "./cadence";
import type { Domain } from "./types";

export interface ParsedTask {
  title: string;
  icon_name: string;
  domain: Domain;
  categories: string[];
  priority: "low" | "medium" | "high";
  energy_level: "low" | "medium" | "high";
  frequency_type: "once" | "daily" | "weekly_count" | "weekdays";
  target_days_per_week: number;
  weekdays: number[];
  estimated_minutes: number;
  due_date: string;
  hints: string[];
}

const DAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const DOMAIN_PATTERNS: [RegExp, Domain][] = [
  [
    /gym|run|walk|health|sleep|water|eat|yoga|steps|workout|stretch|lift|nutrition|cardio|recovery|mobility/i,
    "health",
  ],
  [
    /work|career|interview|client|resume|job|meeting|presentation|leadership|strategy|execute|coding|program/i,
    "career",
  ],
  [/meditat|journal|gratitude|mindful|breath|therapy|reflect|calm|zen|stoic/i, "mindset"],
  [/money|budget|save|invest|finance|expense|crypto|stock|income|bill|tax/i, "finance"],
  [
    /study|learn|course|lecture|language|spanish|french|german|vocab|research|exam|class|reading|book/i,
    "learning",
  ],
  [
    /write|art|paint|draw|design|music|guitar|piano|song|compose|sketch|creative|prototype|side project/i,
    "creativity",
  ],
  [
    /family|friend|mentor|call mom|call dad|date night|reconnect|catch up|community|partner|relationship/i,
    "relationships",
  ],
  [/focus|deep work|pomodoro|distraction|sprint|declutter|admin|priorit/i, "focus"],
];

export function parseQuickAdd(input: string): ParsedTask {
  let text = ` ${input.trim()} `;
  const hints: string[] = [];
  const extractedCategories: string[] = [];

  const strip = (re: RegExp) => {
    text = text.replace(re, " ");
  };

  // Hashtag categories (#health, #focus, #coding)
  const tagMatches = [...text.matchAll(/#([a-zA-Z0-9_-]+)/g)];
  for (const m of tagMatches) {
    if (m[1]) {
      const cat = m[1].toLowerCase();
      if (!extractedCategories.includes(cat)) {
        extractedCategories.push(cat);
      }
      strip(new RegExp(escape(m[0]!), "g"));
    }
  }

  // Frequency: "3x per week", "3x a week", "3 times a week"
  let frequency_type: ParsedTask["frequency_type"] = "once";
  let target_days_per_week = 0;
  let weekdays: number[] = [];

  const perWeek = text.match(/(\d)\s*(?:x|times)\s*(?:per|a|\/)?\s*week/i);
  if (perWeek) {
    frequency_type = "weekly_count";
    target_days_per_week = Number(perWeek[1]);
    hints.push(`${target_days_per_week}× per week`);
    strip(new RegExp(escape(perWeek[0]!), "i"));
  } else if (/\b(every ?day|daily)\b/i.test(text)) {
    frequency_type = "daily";
    hints.push("Daily");
    strip(/\b(every ?day|daily)\b/i);
  } else {
    const dayMatches = [
      ...text.matchAll(
        /\b(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(day|nesday|rsday|urday|sday)?\b/gi,
      ),
    ];
    if (dayMatches.length > 0) {
      weekdays = [
        ...new Set(
          dayMatches.map((m) => DAY_MAP[m[0]!.toLowerCase()]!).filter((d) => d !== undefined),
        ),
      ];
      if (weekdays.length > 0) {
        frequency_type = "weekdays";
        hints.push("Custom weekdays");
        for (const m of dayMatches) strip(new RegExp(escape(m[0]!), "i"));
      }
    }
  }

  // Duration: "30 min", "1h", "45m"
  let estimated_minutes = 25;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  const mins = text.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (hours) {
    estimated_minutes = Math.round(Number(hours[1]) * 60);
    strip(new RegExp(escape(hours[0]!), "i"));
    hints.push(`${estimated_minutes} min`);
  } else if (mins) {
    estimated_minutes = Number(mins[1]);
    strip(new RegExp(escape(mins[0]!), "i"));
    hints.push(`${estimated_minutes} min`);
  }

  // Priority
  let priority: ParsedTask["priority"] = "medium";
  if (/\b(urgent|critical|high priority|!!|top priority)\b/i.test(text)) {
    priority = "high";
    strip(/\b(urgent|critical|high priority|!!|top priority)\b/i);
    hints.push("High priority");
  } else if (/\b(low priority|someday|whenever)\b/i.test(text)) {
    priority = "low";
    strip(/\b(low priority|someday|whenever)\b/i);
    hints.push("Low priority");
  }

  // Energy
  let energy_level: ParsedTask["energy_level"] = "medium";
  if (/\b(high energy|deep work|intense)\b/i.test(text)) {
    energy_level = "high";
    strip(/\b(high energy|deep work|intense)\b/i);
    hints.push("High energy");
  } else if (/\b(low energy|easy|light)\b/i.test(text)) {
    energy_level = "low";
    strip(/\b(low energy|easy|light)\b/i);
    hints.push("Low energy");
  }

  // Date
  let due_date = todayISO();
  if (/\btomorrow\b/i.test(text)) {
    due_date = addDays(todayISO(), 1);
    strip(/\btomorrow\b/i);
    hints.push("Tomorrow");
  } else if (/\bnext week\b/i.test(text)) {
    due_date = addDays(todayISO(), 7);
    strip(/\bnext week\b/i);
    hints.push("Next week");
  } else if (/\btoday\b/i.test(text)) {
    strip(/\btoday\b/i);
  }

  // Time of day → scheduled hint only
  const time = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time) {
    hints.push(`${time[0]!.trim()}`);
    strip(new RegExp(escape(time[0]!), "i"));
  }

  strip(/\b(at|on|for|every)\b/gi);

  const title =
    text
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[-–,]\s*/, "") || input.trim();

  // Pattern detection for all matching domains
  for (const [pattern, dom] of DOMAIN_PATTERNS) {
    if (pattern.test(input)) {
      if (!extractedCategories.includes(dom)) {
        extractedCategories.push(dom);
      }
    }
  }

  if (extractedCategories.length === 0) {
    extractedCategories.push("focus");
  }

  const primaryDomain: Domain = (extractedCategories.find((c) =>
    [
      "focus",
      "health",
      "career",
      "mindset",
      "finance",
      "learning",
      "creativity",
      "relationships",
    ].includes(c),
  ) ?? "focus") as Domain;

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    icon_name: guessIcon(input),
    domain: primaryDomain,
    categories: extractedCategories,
    priority,
    energy_level,
    frequency_type,
    target_days_per_week,
    weekdays,
    estimated_minutes,
    due_date,
    hints,
  };
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const exampleDate = toISO(new Date());
