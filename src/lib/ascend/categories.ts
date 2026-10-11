import { DOMAINS, DOMAIN_TOKEN, type Domain, type Task } from "./types";

export interface CategoryInfo {
  key: string;
  label: string;
  color: string;
  isCustom?: boolean;
}

const CUSTOM_COLORS = [
  "oklch(0.81 0.15 182)",
  "oklch(0.79 0.16 158)",
  "oklch(0.82 0.16 78)",
  "oklch(0.75 0.16 296)",
  "oklch(0.83 0.16 135)",
  "oklch(0.80 0.15 230)",
  "oklch(0.78 0.17 350)",
  "oklch(0.81 0.16 45)",
  "oklch(0.80 0.16 20)",
  "oklch(0.76 0.17 320)",
];

/**
 * Deterministically generates a vibrant, accessible color for any custom category name.
 */
export function getCategoryColor(category: string): string {
  const norm = category.trim().toLowerCase();
  if (norm in DOMAIN_TOKEN) {
    return DOMAIN_TOKEN[norm as Domain];
  }
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CUSTOM_COLORS.length;
  return CUSTOM_COLORS[index]!;
}

/**
 * Returns a human-friendly label for a category.
 */
export function getCategoryLabel(category: string): string {
  const norm = category.trim().toLowerCase();
  const domainMeta = DOMAINS.find((d) => d.key.toLowerCase() === norm);
  if (domainMeta) return domainMeta.label;
  return category
    .trim()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extracts and normalizes the categories assigned to a task.
 * Supports:
 * 1. task.categories array
 * 2. task.domain (single value or comma-separated)
 * 3. Safe fallback to ["focus"] if empty.
 */
export function getTaskCategories(
  task: Partial<Task> | { categories?: string[] | null; domain?: string | null } | null | undefined,
): string[] {
  if (!task) return ["focus"];

  const set = new Set<string>();

  if (Array.isArray(task.categories) && task.categories.length > 0) {
    for (const c of task.categories) {
      if (typeof c === "string" && c.trim()) {
        set.add(c.trim().toLowerCase());
      }
    }
  }

  if (set.size === 0 && typeof task.domain === "string" && task.domain.trim()) {
    const parts = task.domain.split(/[,;|]/);
    for (const p of parts) {
      if (p.trim()) set.add(p.trim().toLowerCase());
    }
  }

  if (set.size === 0) {
    return ["focus"];
  }

  return Array.from(set);
}

/**
 * Returns detailed metadata objects for all categories on a task.
 */
export function getTaskCategoryMetas(
  task: Partial<Task> | { categories?: string[] | null; domain?: string | null } | null | undefined,
): CategoryInfo[] {
  const cats = getTaskCategories(task);
  return cats.map((key) => {
    const norm = key.toLowerCase();
    const domainMeta = DOMAINS.find((d) => d.key.toLowerCase() === norm);
    return {
      key: norm,
      label: domainMeta ? domainMeta.label : getCategoryLabel(key),
      color: domainMeta ? domainMeta.token : getCategoryColor(key),
      isCustom: !domainMeta,
    };
  });
}

/**
 * Checks if a task belongs to a specific category key (case-insensitive).
 */
export function hasCategory(
  task: Partial<Task> | { categories?: string[] | null; domain?: string | null } | null | undefined,
  categoryKey: string,
): boolean {
  if (!task || !categoryKey) return false;
  const target = categoryKey.trim().toLowerCase();
  const categories = getTaskCategories(task);
  return categories.some((c) => c.toLowerCase() === target);
}

/**
 * Collects all unique categories across a list of tasks.
 */
export function getAllUniqueCategories(tasks: Task[]): CategoryInfo[] {
  const map = new Map<string, CategoryInfo>();

  // Always seed with standard domains
  for (const d of DOMAINS) {
    map.set(d.key.toLowerCase(), {
      key: d.key,
      label: d.label,
      color: d.token,
      isCustom: false,
    });
  }

  // Add any custom categories from tasks
  for (const task of tasks) {
    const cats = getTaskCategories(task);
    for (const c of cats) {
      const key = c.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: getCategoryLabel(c),
          color: getCategoryColor(c),
          isCustom: true,
        });
      }
    }
  }

  return Array.from(map.values());
}
