import { describe, it, expect } from "vitest";

type QueueItemStatus =
  | "queued"
  | "syncing"
  | "failed"
  | "completed"
  | "canceled";

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
}

function buildItem(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: "test-id",
    actionType: "vehicle_command",
    payload: { assetId: "asset-1", command: "lock" },
    endpoint: "/api/assets/asset-1/lock",
    method: "POST",
    createdAt: new Date().toISOString(),
    status: "queued",
    retryCount: 0,
    ...overrides,
  };
}

function resolveConfirmMessage(
  queueItems: QueueItem[],
  assetId: string,
  command: string,
  _commandLabel: string,
): { key: string; retries?: number } {
  const endpoint = `/api/assets/${assetId}/${command}`;
  const pendingItem = queueItems.find(
    (item) =>
      item.actionType === "vehicle_command" &&
      item.endpoint === endpoint &&
      (item.status === "queued" ||
        item.status === "syncing" ||
        item.status === "failed"),
  );
  const queuedRetries = pendingItem?.retryCount ?? 0;
  if (queuedRetries > 0) {
    return { key: "confirmCommandWithRetries", retries: queuedRetries };
  }
  return { key: "confirmCommand" };
}

describe("Vehicle command confirmation message selection", () => {
  it("uses base message when queue is empty", () => {
    const result = resolveConfirmMessage([], "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommand");
    expect(result.retries).toBeUndefined();
  });

  it("uses base message when retryCount is 0", () => {
    const items = [buildItem({ retryCount: 0 })];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommand");
    expect(result.retries).toBeUndefined();
  });

  it("uses WithRetries message when retryCount > 0", () => {
    const items = [buildItem({ retryCount: 3 })];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommandWithRetries");
    expect(result.retries).toBe(3);
  });

  it("does not match a completed item", () => {
    const items = [buildItem({ status: "completed", retryCount: 5 })];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommand");
  });

  it("does not match a canceled item", () => {
    const items = [buildItem({ status: "canceled", retryCount: 2 })];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommand");
  });

  it("matches a failed item with retries", () => {
    const items = [buildItem({ status: "failed", retryCount: 2 })];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommandWithRetries");
    expect(result.retries).toBe(2);
  });

  it("matches a syncing item with retries", () => {
    const items = [buildItem({ status: "syncing", retryCount: 1 })];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommandWithRetries");
    expect(result.retries).toBe(1);
  });

  it("does not match a different asset id", () => {
    const items = [
      buildItem({ endpoint: "/api/assets/other-asset/lock", retryCount: 3 }),
    ];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommand");
  });

  it("does not match a different command type", () => {
    const items = [
      buildItem({ endpoint: "/api/assets/asset-1/unlock", retryCount: 3 }),
    ];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommand");
  });

  it("does not match a different action type", () => {
    const items = [
      buildItem({ actionType: "change_incident_status", retryCount: 3 }),
    ];
    const result = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(result.key).toBe("confirmCommand");
  });

  it("returns highest-retries item when multiple pending exist", () => {
    const items = [
      buildItem({ id: "a", retryCount: 1 }),
      buildItem({ id: "b", retryCount: 4 }),
    ];
    const first = resolveConfirmMessage(items, "asset-1", "lock", "Lock");
    expect(first.retries).toBe(1);
  });
});
