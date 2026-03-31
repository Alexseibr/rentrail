import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getQueueItems, processQueue, onQueueChange, startAutoSync, stopAutoSync, type QueueItem } from "@/services/sync-queue";

interface SyncContextType {
  queueItems: QueueItem[];
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  lastSyncResult: { processed: number; failed: number } | null;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ processed: number; failed: number } | null>(null);

  useEffect(() => {
    getQueueItems().then(setQueueItems);
    startAutoSync();

    const unsub = onQueueChange(setQueueItems);

    const appSub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        processQueue();
      }
    });

    return () => {
      unsub();
      appSub.remove();
      stopAutoSync();
    };
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await processQueue();
      setLastSyncResult(result);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const pendingCount = queueItems.filter(
    (i) => i.status === "queued" || i.status === "failed",
  ).length;

  return (
    <SyncContext.Provider value={{ queueItems, pendingCount, isSyncing, syncNow, lastSyncResult }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
