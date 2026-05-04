import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNetworkState, onNetworkChange } from "./network";
import { getAccessToken, getCompanyId, getBranchId } from "./api";
import { isQueueable } from "./offline-policy";

const QUEUE_KEY = "sync_mutation_queue";

export type QueueItemStatus = "queued" | "syncing" | "failed" | "completed" | "canceled";

export interface QueueItem {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  createdAt: string;
  status: QueueItemStatus;
  retryCount: number;
  lastError?: string;
  companyId?: string;
  branchId?: string;
  completedAt?: string;
  snoozed?: boolean;
}

export const AUTO_CLEAR_DELAY_MS = 30_000;

type QueueListener = (items: QueueItem[]) => void;
const _listeners: Set<QueueListener> = new Set();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function loadQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveQueue(items: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  _listeners.forEach((fn) => fn(items));
}

export async function enqueue(params: {
  actionType: string;
  payload: Record<string, unknown>;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
}): Promise<QueueItem | null> {
  if (!isQueueable(params.actionType)) return null;

  const companyId = await getCompanyId();
  const branchId = await getBranchId();

  const item: QueueItem = {
    id: generateId(),
    actionType: params.actionType,
    payload: params.payload,
    endpoint: params.endpoint,
    method: params.method,
    createdAt: new Date().toISOString(),
    status: "queued",
    retryCount: 0,
    companyId: companyId ?? undefined,
    branchId: branchId ?? undefined,
  };

  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);
  return item;
}

export async function getQueueItems(): Promise<QueueItem[]> {
  return loadQueue();
}

export async function getPendingCount(): Promise<number> {
  const items = await loadQueue();
  return items.filter((i) => i.status === "queued" || i.status === "failed").length;
}

export async function cancelItem(id: string) {
  const queue = await loadQueue();
  const updated = queue.map((item) =>
    item.id === id && (item.status === "queued" || item.status === "failed")
      ? { ...item, status: "canceled" as const, completedAt: new Date().toISOString() }
      : item,
  );
  await saveQueue(updated);
}

export async function retryItem(id: string) {
  const queue = await loadQueue();
  const updated = queue.map((item) =>
    item.id === id && item.status === "failed"
      ? { ...item, status: "queued" as const, retryCount: 0, lastError: undefined }
      : item,
  );
  await saveQueue(updated);
}

export async function retryAllFailed(): Promise<number> {
  const queue = await loadQueue();
  let count = 0;
  const updated = queue.map((item) => {
    if (item.status !== "failed") return item;
    count++;
    return { ...item, status: "queued" as const, retryCount: 0, lastError: undefined };
  });
  if (count > 0) {
    await saveQueue(updated);
  }
  return count;
}

export async function clearCompleted() {
  const queue = await loadQueue();
  const active = queue.filter((i) => i.status !== "completed" && i.status !== "canceled");
  await saveQueue(active);
}

export async function clearCompletedOlderThan(ageMs: number) {
  const queue = await loadQueue();
  const now = Date.now();
  const remaining = queue.filter((item) => {
    if (item.status !== "completed" && item.status !== "canceled") return true;
    if (item.snoozed) return true;
    const completedAt = item.completedAt ? new Date(item.completedAt).getTime() : 0;
    return now - completedAt < ageMs;
  });
  if (remaining.length !== queue.length) {
    await saveQueue(remaining);
  }
}

export async function setItemSnoozed(id: string, snoozed: boolean) {
  const queue = await loadQueue();
  let changed = false;
  const updated = queue.map((item) => {
    if (item.id !== id) return item;
    if (item.status !== "completed" && item.status !== "canceled") return item;
    if (!!item.snoozed === snoozed) return item;
    changed = true;
    if (snoozed) {
      return { ...item, snoozed: true };
    }
    return { ...item, snoozed: false, completedAt: new Date().toISOString() };
  });
  if (changed) {
    await saveQueue(updated);
  }
}

let _syncing = false;

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  if (_syncing) return { processed: 0, failed: 0 };

  const network = getNetworkState();
  if (!network.isConnected) return { processed: 0, failed: 0 };

  _syncing = true;
  let processed = 0;
  let failed = 0;

  try {
    const token = await getAccessToken();
    if (!token) return { processed: 0, failed: 0 };

    const queue = await loadQueue();
    const pending = queue.filter((i) => i.status === "queued" || i.status === "failed");

    for (const item of pending) {
      if (item.retryCount >= 5) {
        item.status = "failed";
        item.lastError = "Max retries exceeded";
        failed++;
        continue;
      }

      item.status = "syncing";
      await saveQueue(queue);

      try {
        const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        if (item.companyId) headers["x-company-id"] = item.companyId;
        if (item.branchId) headers["x-branch-id"] = item.branchId;

        const response = await fetch(`${baseUrl}${item.endpoint}`, {
          method: item.method,
          headers,
          body: JSON.stringify(item.payload),
        });

        if (response.ok) {
          item.status = "completed";
          item.completedAt = new Date().toISOString();
          processed++;
        } else {
          const errBody = await response.text();
          item.status = "failed";
          item.retryCount++;
          item.lastError = `HTTP ${response.status}: ${errBody.slice(0, 200)}`;
          failed++;
        }
      } catch (err: unknown) {
        item.status = "failed";
        item.retryCount++;
        item.lastError = err instanceof Error ? err.message : "Unknown error";
        failed++;
      }
    }

    await saveQueue(queue);
  } finally {
    _syncing = false;
  }

  return { processed, failed };
}

export function onQueueChange(fn: QueueListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

let _unsubNetwork: (() => void) | null = null;

export function startAutoSync() {
  if (_unsubNetwork) return;
  _unsubNetwork = onNetworkChange((state) => {
    if (state.isConnected) {
      processQueue();
    }
  });
}

export function stopAutoSync() {
  if (_unsubNetwork) {
    _unsubNetwork();
    _unsubNetwork = null;
  }
}
