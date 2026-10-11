import { describe, expect, it } from "vitest";
import { persistTaskWrite } from "@/lib/ascend/task-writes";

describe("rapid task persistence", () => {
  it("keeps same-task writes in click order while other tasks remain independent", async () => {
    let release: () => void = () => undefined;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const saved: string[] = [];
    const first = persistTaskWrite("a", async () => { await wait; saved.push("done"); });
    const second = persistTaskWrite("a", async () => { saved.push("undone"); });
    await persistTaskWrite("b", async () => { saved.push("other"); });
    expect(saved).toEqual(["other"]);
    release();
    await Promise.all([first, second]);
    expect(saved).toEqual(["other", "done", "undone"]);
  });

  it("does not block later edits after a failed write", async () => {
    const failed = persistTaskWrite("failure", async () => { throw new Error("storage unavailable"); });
    const next = persistTaskWrite("failure", async () => "saved");
    await expect(failed).rejects.toThrow("storage unavailable");
    await expect(next).resolves.toBe("saved");
  });
});