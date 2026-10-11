import { describe, expect, it } from "vitest";
import { TREE_VIEW, SKILL_TREE_VIEW, branchGeometry, classicBranch, growthScale, treeSummary, treeHistory, seasonSummary, skillBranch } from "@/lib/ascend/growth-tree";
import { presetRange } from "@/lib/ascend/range";
import type { Task } from "@/lib/ascend/types";

describe("long-lived Growth Tree", () => {
  it("preserves a golden tree and starts a seedling exactly at season boundaries", () => {
    const task = { domain: "focus", completed_dates: Array(2000).fill("2026-01-01") } as Task;
    const history = treeHistory([task], "1970-01-01", "2030-01-01");
    expect(history.seasonCount).toBe(3);
    expect(seasonSummary(history, 0).stage.label).toBe("Golden");
    expect(seasonSummary(history, 1).completions).toBe(1000);
    expect(seasonSummary(history, 2).completions).toBe(0);
    expect(seasonSummary(history, 999).index).toBe(2);
  });

  it("derives seasons deterministically and keeps all domain history", () => {
    const dates = Array.from({ length: 50 * 365 }, (_, i) => new Date(Date.UTC(1970, 0, i + 1)).toISOString().slice(0, 10));
    const tasks = ["focus", "health"].map((domain) => ({ domain, completed_dates: dates }) as Task);
    const history = treeHistory(tasks, "1970-01-01", "2030-01-01");
    const reversed = treeHistory([...tasks].reverse(), "1970-01-01", "2030-01-01");
    expect(history.total).toBe(36500);
    const seasons = Array.from({ length: history.seasonCount }, (_, i) => seasonSummary(history, i));
    expect(seasons.reduce((sum, s) => sum + s.completions, 0)).toBe(history.total);
    expect(seasons.at(-1)?.completions).toBe(500);
    expect(seasonSummary(history, 4)).toEqual(seasonSummary(reversed, 4));
    expect(seasonSummary(history, 4).branches.filter((b) => b.count > 0).map((b) => b.count)).toEqual([500, 500]);
    expect(treeHistory(tasks, "1970-01-01", "1970-01-01").total).toBe(2);
  });

  it("moves through blossoms and fruit before preserving a golden season", () => {
    for (const [count, stage] of [[0, "Seedling"], [100, "Growing"], [600, "Mature"], [750, "Blossoming"], [900, "Fruiting"], [1000, "Golden"]] as const) {
      const history = treeHistory([{ domain: "health", completed_dates: Array(count).fill("2026-01-01") } as Task], "1970-01-01", "2030-01-01");
      expect(seasonSummary(history, 0).stage.label).toBe(stage);
    }
  });

  it("keeps original skill branches, milestone decoration and labels in bounds", () => {
    for (const total of [0, 1, 10, 100, 750, 900, 1000, 1000000000]) {
      for (let i = 0; i < 8; i++) {
        const b = skillBranch(i, total);
        expect(b.endX - 18).toBeGreaterThan(0);
        expect(b.endX + 18).toBeLessThan(SKILL_TREE_VIEW.width);
        expect(b.endY - 18).toBeGreaterThan(0);
        expect(b.endY + 18).toBeLessThan(SKILL_TREE_VIEW.height);
        expect(b.labelX - 70).toBeGreaterThan(0);
        expect(b.labelX + 70).toBeLessThan(SKILL_TREE_VIEW.width);
      }
    }
  });
  it("keeps growing beyond ten years without a fixed completion ceiling", () => {
    const totals = [0, 1, 50, 3650, 36500, 73000, 1000000, 1000000000];
    totals.forEach((total, index) => {
      const scale = growthScale(total);
      expect(scale.next).toBeGreaterThan(total);
      expect(scale.progress).toBeGreaterThanOrEqual(0);
      expect(scale.progress).toBeLessThan(1);
      expect(scale.leaves).toBeLessThanOrEqual(24);
      expect(scale.size).toBeLessThan(1);
      if (index > 0) expect(scale.size).toBeGreaterThan(growthScale(totals[index - 1] ?? 0).size);
    });
    expect(growthScale(73000).rings).toBeGreaterThan(growthScale(36500).rings);
  });

  it("increments a ring exactly at each milestone", () => {
    for (const milestone of [10, 30, 70, 150, 310, 630, 1270, 40950]) {
      expect(growthScale(milestone).rings).toBe(growthScale(milestone - 1).rings + 1);
      expect(growthScale(milestone).progress).toBe(0);
    }
  });

  it("keeps every branch and leaf inside a stable viewport, even at extreme totals", () => {
    for (const total of [0, 1, 100, 36500, 1000000000]) {
      const height = 100 + growthScale(total).size * 255;
      for (let index = 0; index < 8; index++) {
        const branch = branchGeometry(index, total, height);
        expect(branch.endX - 18).toBeGreaterThan(0);
        expect(branch.endX + 18).toBeLessThan(400);
        expect(branch.endY - 18).toBeGreaterThan(0);
        expect(branch.baseY + 18).toBeLessThan(440);
      }
    }
  });

  it("classic tree stays fully inside its frame from day one to a billion completions", () => {
    for (const total of [0, 1, 10, 365, 3650, 36500, 365000, 1000000000]) {
      for (let i = 0; i < 8; i++) {
        const b = classicBranch(i, 8, total);
        const reach = b.radius + b.leafR + 6; // leaves + glow
        expect(b.endX - reach).toBeGreaterThan(0);
        expect(b.endX + reach).toBeLessThan(TREE_VIEW.width);
        expect(b.endY - reach).toBeGreaterThan(0);
        expect(b.baseY + 10).toBeLessThan(TREE_VIEW.groundY);
      }
    }
    // Still visibly growing between year 10 and year 20 of daily completions.
    expect(classicBranch(0, 8, 7300).length - classicBranch(0, 8, 3650).length).toBeGreaterThan(1);
  });

  it("counts decades of history exactly without generating calendar-day nodes", () => {
    const dates = Array.from({ length: 20 * 365 }, (_, i) => new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10));
    const tasks = Array.from({ length: 8 }, (_, i) => ({ domain: ["focus", "health", "career", "mindset", "finance", "learning", "creativity", "relationships"][i], completed_dates: dates }) as Task);
    const summary = treeSummary(tasks, "1970-01-01", "2030-01-01");
    expect(summary.completions).toBe(58400);
    expect(summary.branches.every((branch) => branch.count === 7300)).toBe(true);
    expect(summary.branches.length).toBe(8);
    expect(presetRange("all").from).toBe("1970-01-01");
    expect(treeSummary(tasks, "2000-01-01", "2000-01-31").completions).toBe(248);
  });
});