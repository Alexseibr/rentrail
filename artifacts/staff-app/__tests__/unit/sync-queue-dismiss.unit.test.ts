import { describe, it, expect } from "vitest";

type QueueItemStatus = "queued" | "syncing" | "failed" | "completed" | "canceled";

interface QueueItem {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  createdAt: string;
  status: QueueItemStatus;
  retryCount: number;
  lastError?: string;
  completedAt?: string;
  snoozed?: boolean;
}

function makeDismissFilter(id: string) {
  return (item: QueueItem): boolean =>
    !(
      item.id === id &&
      (item.status === "completed" || item.status === "canceled") &&
      !!item.snoozed
    );
}

function buildItem(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: "test-id",
    actionType: "create_incident",
    payload: {},
    endpoint: "/api/incidents",
    method: "POST",
    createdAt: new Date().toISOString(),
    status: "completed",
    retryCount: 0,
    ...overrides,
  };
}

describe("dismissItem filter predicate", () => {
  it("removes a snoozed completed item with matching id", () => {
    const queue: QueueItem[] = [buildItem({ id: "abc", status: "completed", snoozed: true })];
    const filtered = queue.filter(makeDismissFilter("abc"));
    expect(filtered).toHaveLength(0);
  });

  it("removes a snoozed canceled item with matching id", () => {
    const queue: QueueItem[] = [buildItem({ id: "abc", status: "canceled", snoozed: true })];
    const filtered = queue.filter(makeDismissFilter("abc"));
    expect(filtered).toHaveLength(0);
  });

  it("keeps a completed snoozed item when id does not match", () => {
    const queue: QueueItem[] = [buildItem({ id: "other", status: "completed", snoozed: true })];
    const filtered = queue.filter(makeDismissFilter("abc"));
    expect(filtered).toHaveLength(1);
  });

  it("keeps a completed item that is not snoozed (auto-clearing)", () => {
    const queue: QueueItem[] = [buildItem({ id: "abc", status: "completed", snoozed: false })];
    const filtered = queue.filter(makeDismissFilter("abc"));
    expect(filtered).toHaveLength(1);
  });

  it("keeps a queued item even when id matches", () => {
    const queue: QueueItem[] = [buildItem({ id: "abc", status: "queued", snoozed: true })];
    const filtered = queue.filter(makeDismissFilter("abc"));
    expect(filtered).toHaveLength(1);
  });

  it("keeps a failed item even when id matches", () => {
    const queue: QueueItem[] = [buildItem({ id: "abc", status: "failed", snoozed: true })];
    const filtered = queue.filter(makeDismissFilter("abc"));
    expect(filtered).toHaveLength(1);
  });

  it("keeps a syncing item even when id matches", () => {
    const queue: QueueItem[] = [buildItem({ id: "abc", status: "syncing", snoozed: true })];
    const filtered = queue.filter(makeDismissFilter("abc"));
    expect(filtered).toHaveLength(1);
  });

  it("only removes the targeted row from a mixed queue", () => {
    const queue: QueueItem[] = [
      buildItem({ id: "target", status: "completed", snoozed: true }),
      buildItem({ id: "other-pinned", status: "canceled", snoozed: true }),
      buildItem({ id: "queued-1", status: "queued" }),
      buildItem({ id: "failed-1", status: "failed" }),
    ];
    const filtered = queue.filter(makeDismissFilter("target"));
    expect(filtered).toHaveLength(3);
    expect(filtered.find((i) => i.id === "target")).toBeUndefined();
    expect(filtered.find((i) => i.id === "other-pinned")).toBeDefined();
    expect(filtered.find((i) => i.id === "queued-1")).toBeDefined();
    expect(filtered.find((i) => i.id === "failed-1")).toBeDefined();
  });

  it("returns the same array length when no item matches", () => {
    const queue: QueueItem[] = [
      buildItem({ id: "queued-1", status: "queued" }),
      buildItem({ id: "failed-1", status: "failed" }),
    ];
    const filtered = queue.filter(makeDismissFilter("no-such-id"));
    expect(filtered).toHaveLength(2);
  });
});
