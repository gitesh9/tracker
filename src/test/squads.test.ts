import { describe, expect, it } from "vitest";
import {
  addMember,
  applySquadOp,
  createSquadDoc,
  importSquadDoc,
  normaliseCode,
  touchMember,
  type SquadOp,
} from "@/lib/squads/ops";

const alice = { id: "a", name: "Alice", streak: 3, todayCompletions: 1 };
const bob = { id: "b", name: "Bob" };

function squad() {
  return createSquadDoc(
    { opId: "c1", kind: "create", squadId: "s1", name: "Climbers", description: "", code: "SQUAD-X" },
    alice,
  );
}

describe("shared squads", () => {
  it("creator leads, joiner becomes a member once", () => {
    const s = addMember(addMember(squad(), bob), bob);
    expect(s.members.map((m) => [m.id, m.role])).toEqual([
      ["a", "leader"],
      ["b", "member"],
    ]);
  });

  it("applies each change exactly once, even when retried", () => {
    const op: SquadOp = {
      opId: "g1",
      kind: "add_goal",
      squadId: "s1",
      goal: { id: "goal1", title: "Ship", domain: "career", targetCount: 2, unit: "tasks" },
    };
    const once = applySquadOp(squad(), op, alice);
    const twice = applySquadOp(once, op, alice);
    expect(twice.goals).toHaveLength(1);
  });

  it("two people's changes both survive", () => {
    let s = addMember(squad(), bob);
    s = applySquadOp(s, { opId: "t1", kind: "add_task", squadId: "s1", task: { id: "x", title: "A", domain: "focus" } }, alice);
    s = applySquadOp(s, { opId: "t2", kind: "add_task", squadId: "s1", task: { id: "y", title: "B", domain: "focus" } }, bob);
    s = applySquadOp(s, { opId: "d1", kind: "set_task_done", squadId: "s1", taskId: "x", done: true }, bob);
    expect(s.tasks.map((t) => t.id).sort()).toEqual(["x", "y"]);
    expect(s.tasks.find((t) => t.id === "x")?.completedBy).toBe("Bob");
    // Marking done again is a no-op rather than a toggle back.
    const again = applySquadOp(s, { opId: "d2", kind: "set_task_done", squadId: "s1", taskId: "x", done: true }, bob);
    expect(again.tasks.find((t) => t.id === "x")?.isCompleted).toBe(true);
  });

  it("cannot cheer yourself; can cheer a teammate", () => {
    let s = addMember(squad(), bob);
    s = applySquadOp(s, { opId: "h1", kind: "cheer", squadId: "s1", memberId: "a" }, alice);
    s = applySquadOp(s, { opId: "h2", kind: "cheer", squadId: "s1", memberId: "a" }, bob);
    expect(s.members.find((m) => m.id === "a")?.cheersReceived).toBe(1);
  });

  it("leaving hands leadership on", () => {
    const s = applySquadOp(addMember(squad(), bob), { opId: "l1", kind: "leave", squadId: "s1" }, alice);
    expect(s.members).toEqual([expect.objectContaining({ id: "b", role: "leader" })]);
  });

  it("imports a pre-sign-in squad as the signed-in user", () => {
    const local = { ...squad(), members: [{ ...squad().members[0]!, id: "member-me" }] };
    expect(importSquadDoc(local, bob, "i1").members[0]).toMatchObject({ id: "b", role: "leader" });
  });

  it("touch only writes when stats change", () => {
    const s = squad();
    expect(touchMember(s, alice)).toBeNull();
    expect(touchMember(s, { ...alice, todayCompletions: 2 })?.members[0]?.todayCompletions).toBe(2);
  });

  it("accepts codes typed loosely", () => {
    expect(normaliseCode(" squad-abc ")).toBe("SQUAD-ABC");
    expect(normaliseCode("abc")).toBe("SQUAD-ABC");
  });
});
