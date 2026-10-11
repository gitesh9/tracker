import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync/remote", () => ({
  syncWithRemote: sync,
  SignInRequiredError: class extends Error {},
}));
import { enqueue, flushQueue, queueSize } from "@/lib/ascend/offline";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    window: Object.assign(new EventTarget(), { localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    } }),
    CustomEvent: class extends Event {
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) { super(type); this.detail = init?.detail; }
    },
  });
});

describe("edits during sync", () => {
  it("keeps a newer same-row edit when an older request finishes", async () => {
    let release: (configured: boolean) => void = () => undefined;
    sync.mockImplementationOnce(() => new Promise<boolean>((resolve) => { release = resolve; }));
    enqueue({ kind: "upsert", table: "tasks", rowId: "t", row: { title: "A" } });
    const flight = flushQueue();
    enqueue({ kind: "update", table: "tasks", rowId: "t", patch: { title: "B" } });
    release(true);
    await flight;
    expect(queueSize()).toBe(1);
    expect(JSON.parse(store.get("ascend.offline.queue.v1") ?? "[]")[0].row.title).toBe("B");
  });
});