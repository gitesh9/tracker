import { describe, expect, it } from "vitest";
import { weeklyRecap } from "@/lib/ascend/recap";
import type { Task } from "@/lib/ascend/types";

const t = (domain: string, dates: string[]) => ({ domain, completed_dates: dates }) as unknown as Task;

describe("weekly recap", () => {
  it("counts only the last seven days", () => {
    const r = weeklyRecap(
      [t("health", ["2026-10-22", "2026-10-27", "2026-10-28", "2026-10-21"]), t("career", ["2026-10-28"])],
      "2026-10-28",
    );
    expect(r.completions).toBe(4);
    expect(r.activeDays).toBe(3);
    expect(r.topDomain).toBe("health");
    expect(r.bestDay).toBe("2026-10-28");
  });
});
