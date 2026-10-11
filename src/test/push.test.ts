import { describe, expect, it } from "vitest";
import { isDue, localClock } from "@/lib/push/webpush.server";

describe("background reminder timing", () => {
  it("is due inside the catch-up window only", () => {
    expect(isDue("09:00:00", 9 * 60)).toBe(true);
    expect(isDue("09:00:00", 9 * 60 + 9)).toBe(true);
    expect(isDue("09:00:00", 9 * 60 + 10)).toBe(false);
    expect(isDue("09:00:00", 8 * 60 + 59)).toBe(false);
    expect(isDue("garbage", 0)).toBe(false);
  });

  it("reads the local clock in the subscriber's time zone", () => {
    const at = new Date("2026-10-08T16:40:00Z");
    expect(localClock("Asia/Kolkata", at)).toEqual({ day: "2026-10-08", minutes: 22 * 60 + 10 });
    expect(localClock("UTC", at)).toEqual({ day: "2026-10-08", minutes: 16 * 60 + 40 });
    expect(localClock("Not/AZone", at).minutes).toBe(16 * 60 + 40);
  });
});
