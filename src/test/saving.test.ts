import { beforeEach, describe, expect, it } from "vitest";

// Minimal browser stand-ins so the save queue and store run under Node.
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  }),
  CustomEvent: class extends Event {
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      super(type);
      this.detail = init?.detail;
    }
  },
});

const { enqueue, queueSize, pendingTables } = await import("@/lib/ascend/offline");
const { localDB } = await import("@/lib/ascend/local-store");

describe("saving tasks", () => {
  beforeEach(() => store.clear());

  it("saves a new task and finds it again", () => {
    const saved = localDB.saveTask({ title: "Write journal" });
    expect(localDB.getTasks().some((t) => t.id === saved.id && t.title === "Write journal")).toBe(true);
  });

  it("updates keep the other fields", () => {
    const saved = localDB.saveTask({ title: "Stretch", estimated_minutes: 10 });
    localDB.updateTask(saved.id, { title: "Stretch well" });
    const found = localDB.getTasks().find((t) => t.id === saved.id)!;
    expect(found.title).toBe("Stretch well");
    expect(found.estimated_minutes).toBe(10);
  });
});

describe("sync queue", () => {
  beforeEach(() => store.clear());

  it("collapses many edits of one task into a single change", () => {
    enqueue({ kind: "upsert", table: "tasks", rowId: "t1", row: { title: "A" } });
    enqueue({ kind: "update", table: "tasks", rowId: "t1", patch: { title: "B" } });
    enqueue({ kind: "update", table: "tasks", rowId: "t1", patch: { notes: "n" } });
    expect(queueSize()).toBe(1);
    expect(pendingTables().has("tasks")).toBe(true);
  });

  it("deleting a never-synced task leaves nothing to send", () => {
    enqueue({ kind: "upsert", table: "tasks", rowId: "t2", row: { title: "A" } });
    enqueue({ kind: "upsert", table: "subtasks", rowId: "s1", row: { task_id: "t2", title: "x" } });
    enqueue({ kind: "delete", table: "tasks", rowId: "t2" });
    expect(queueSize()).toBe(0);
  });
});
