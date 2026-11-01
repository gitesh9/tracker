import { describe, expect, it, vi } from "vitest";
import type { Goal } from "@/lib/ascend/types";

const durable = vi.hoisted(() => new Map<string, Goal>());
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
  useMutation: (options: unknown) => options,
  useQuery: vi.fn(),
}));
vi.mock("@/lib/db/pglite", () => ({
  localDb: { from: () => ({ upsert: (row: Goal) => ({ select: () => ({ single: async () => {
    durable.set(row.id, row);
    return { data: row, error: null };
  } }) }) }) },
}));
vi.mock("@/lib/ascend/offline", () => ({ enqueue: vi.fn(), hasPending: () => false, isOffline: () => false }));
vi.mock("@/lib/ascend/squads-remote", () => ({}));
vi.mock("@/lib/ascend/identity", () => ({ getLocalUser: () => ({ id: "guest_user" }) }));
vi.mock("@/lib/ascend/local-store", () => ({ localDB: {
  getGoals: () => [{ id: "goal-new", title: "Interview preparation" }],
  saveGoal: (row: Goal) => row,
} }));

import { useSaveGoal } from "@/lib/ascend/queries";

describe("goal durability", () => {
  it("persists a new goal even when optimistic state already contains its id", async () => {
    vi.stubGlobal("window", {});
    const options = useSaveGoal() as unknown as { mutationFn: (input: Partial<Goal> & { title: string }) => Promise<Goal> };
    const saved = await options.mutationFn({ id: "goal-new", title: "Interview preparation" });
    expect(durable.get("goal-new")?.title).toBe("Interview preparation");
    expect(saved.id).toBe("goal-new");
    vi.unstubAllGlobals();
  });
});