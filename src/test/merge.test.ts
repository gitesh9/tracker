import { describe, expect, it } from "vitest";
import { clampEditTime, mergeFields } from "@/lib/sync/merge";

describe("sync field merge", () => {
  it("keeps edits to different fields from two devices", () => {
    const a = mergeFields({ title: "Run", notes: "" }, {}, { title: "Run 5k" }, 100);
    const b = mergeFields(a.data, a.fieldTimes, { notes: "Before work" }, 90);
    expect(b.data).toEqual({ title: "Run 5k", notes: "Before work" });
  });

  it("never lets an older edit overwrite a newer one", () => {
    const newer = mergeFields({}, {}, { title: "New" }, 200);
    const late = mergeFields(newer.data, newer.fieldTimes, { title: "Old" }, 150);
    expect(late.data["title"]).toBe("New");
    expect(late.changed).toBe(false);
  });

  it("caps edit times from clocks running in the future", () => {
    expect(clampEditTime(10_000_000, 1_000)).toBe(61_000);
    expect(clampEditTime(undefined, 5)).toBe(5);
  });
});
