import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useSync } from "@/contexts/SyncContext";
import {
  cancelItem,
  retryItem,
  retryAllFailed,
  clearCompleted,
  setItemSnoozed,
  dismissItem,
  AUTO_CLEAR_DELAY_MS,
} from "@/services/sync-queue";
import { getActionDescription } from "@/services/offline-policy";
import type { QueueItem, QueueItemStatus } from "@/services/sync-queue";

type StatusFilter = "all" | "pending" | "failed" | "done";

const FILTER_STORAGE_KEY = "sync_queue_filter";

const FILTER_MATCHERS: Record<StatusFilter, (status: QueueItemStatus) => boolean> = {
  all: () => true,
  pending: (s) => s === "queued" || s === "syncing",
  failed: (s) => s === "failed",
  done: (s) => s === "completed" || s === "canceled",
};

const FILTER_ORDER: StatusFilter[] = ["all", "pending", "failed", "done"];

const STATUS_SORT_PRIORITY: Record<QueueItemStatus, number> = {
  failed: 0,
  syncing: 1,
  queued: 1,
  completed: 2,
  canceled: 2,
};

const sortQueueItems = (items: QueueItem[]): QueueItem[] =>
  [...items].sort((a, b) => {
    const priorityDiff = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

const STATUS_ICONS: Record<string, string> = {
  queued: "clock",
  syncing: "refresh-cw",
  failed: "alert-circle",
  completed: "check-circle",
  canceled: "x-circle",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "#f59e0b",
  syncing: "#3b82f6",
  failed: "#ef4444",
  completed: "#10b981",
  canceled: "#6b7280",
};

function formatElapsed(ms: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (mins < 1) return t("myShift.justNow");
  if (hours < 1) return t("myShift.timeAgo", { time: t("myShift.minutesShort", { m: mins }) });
  if (days < 1) return t("myShift.timeAgo", { time: t("myShift.hoursShort", { h: hours }) });
  return t("myShift.timeAgo", { time: t("myShift.daysShort", { d: days }) });
}

export default function SyncQueueScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { queueItems, isSyncing, syncNow } = useSync();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const hydratedRef = React.useRef(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(FILTER_STORAGE_KEY)
      .then((saved) => {
        if (cancelled || hydratedRef.current) return;
        hydratedRef.current = true;
        if (!saved) return;
        if (saved === "all" || saved === "pending" || saved === "failed" || saved === "done") {
          setFilter(saved);
        }
      })
      .catch(() => {
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasClearingItems = useMemo(
    () =>
      queueItems.some(
        (i) =>
          (i.status === "completed" || i.status === "canceled") &&
          i.completedAt &&
          !i.snoozed,
      ),
    [queueItems],
  );

  const hasSnoozedItems = useMemo(
    () => queueItems.some((i) => i.snoozed && i.completedAt),
    [queueItems],
  );

  useEffect(() => {
    if (!hasClearingItems && !hasSnoozedItems) return;
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [hasClearingItems, hasSnoozedItems]);

  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: 0, pending: 0, failed: 0, done: 0 };
    for (const item of queueItems) {
      counts.all++;
      if (FILTER_MATCHERS.pending(item.status)) counts.pending++;
      if (FILTER_MATCHERS.failed(item.status)) counts.failed++;
      if (FILTER_MATCHERS.done(item.status)) counts.done++;
    }
    return counts;
  }, [queueItems]);

  const visibleItems = useMemo(
    () => sortQueueItems(queueItems.filter((i) => FILTER_MATCHERS[filter](i.status))),
    [queueItems, filter],
  );

  const handleSelectFilter = (next: StatusFilter) => {
    if (next === filter) return;
    hydratedRef.current = true;
    setFilter(next);
    AsyncStorage.setItem(FILTER_STORAGE_KEY, next).catch(() => {});
    Haptics.selectionAsync();
  };

  const handleCancel = (item: QueueItem) => {
    const confirmMsg = item.retryCount > 0
      ? t("syncQueue.cancelConfirmWithRetries", { action: getActionDescription(item.actionType), queued: new Date(item.createdAt).toLocaleString(), retries: item.retryCount })
      : t("syncQueue.cancelConfirm", { action: getActionDescription(item.actionType), queued: new Date(item.createdAt).toLocaleString() });
    Alert.alert(t("syncQueue.cancelAction"), confirmMsg, [
      { text: t("syncQueue.no"), style: "cancel" },
      {
        text: t("syncQueue.yes"),
        style: "destructive",
        onPress: async () => {
          await cancelItem(item.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const handleRetry = async (item: QueueItem) => {
    await retryItem(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearCompleted = () => {
    const pinnedItems = queueItems.filter(
      (i) => (i.status === "completed" || i.status === "canceled") && i.snoozed,
    );
    const pinnedCount = pinnedItems.length;

    const doClear = async () => {
      await clearCompleted();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    if (pinnedCount > 0) {
      const MAX_SHOWN = 5;
      const shown = pinnedItems.slice(0, MAX_SHOWN);
      const remaining = pinnedCount - shown.length;

      const lines: string[] = [t("syncQueue.clearDoneConfirmHeader", { count: pinnedCount })];
      for (const item of shown) {
        lines.push(`• ${getActionDescription(item.actionType)}`);
      }
      if (remaining > 0) {
        lines.push(t("syncQueue.clearDoneConfirmAndMore", { count: remaining }));
      }

      Alert.alert(
        t("syncQueue.clearDoneConfirmTitle"),
        lines.join("\n"),
        [
          { text: t("syncQueue.no"), style: "cancel" },
          { text: t("syncQueue.clearDoneConfirmOk"), style: "destructive", onPress: doClear },
        ],
      );
    } else {
      doClear();
    }
  };

  const handleRetryAllFailed = async () => {
    const count = await retryAllFailed();
    if (count > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleToggleSnooze = async (item: QueueItem) => {
    await setItemSnoozed(item.id, !item.snoozed);
    Haptics.selectionAsync();
  };

  const handleDismiss = async (item: QueueItem) => {
    await dismissItem(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderItem = ({ item }: { item: QueueItem }) => {
    const isDone = item.status === "completed" || item.status === "canceled";
    const isSnoozed = isDone && !!item.snoozed;
    const isClearing = isDone && !!item.completedAt && !isSnoozed;
    let secondsLeft: number | null = null;
    let fadeOpacity = 1;
    if (isClearing && item.completedAt) {
      const completedMs = new Date(item.completedAt).getTime();
      const remainingMs = Math.max(0, completedMs + AUTO_CLEAR_DELAY_MS - now);
      secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));
      const progress = Math.min(1, Math.max(0, remainingMs / AUTO_CLEAR_DELAY_MS));
      fadeOpacity = 0.4 + progress * 0.6;
    }
    const statusColor = STATUS_COLORS[item.status] ?? colors.mutedForeground;
    return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isSnoozed ? statusColor + "60" : colors.border,
          borderWidth: isSnoozed ? 1.5 : 1,
          opacity: fadeOpacity,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Feather
          name={(STATUS_ICONS[item.status] ?? "circle") as any}
          size={18}
          color={statusColor}
        />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {getActionDescription(item.actionType)}
        </Text>
        {isSnoozed && (
          <Feather name="bookmark" size={14} color={statusColor} />
        )}
        <Text style={[styles.cardStatus, { color: statusColor }]}>
          {item.status}
        </Text>
      </View>
      <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
        {new Date(item.createdAt).toLocaleString()}
        {item.retryCount > 0 ? ` · ${item.retryCount} ${t("syncQueue.retries")}` : ""}
      </Text>
      {item.lastError && (
        <Text style={[styles.cardError, { color: colors.destructive }]} numberOfLines={2}>
          {item.lastError}
        </Text>
      )}
      {isClearing && secondsLeft !== null && (
        <TouchableOpacity
          onPress={() => handleToggleSnooze(item)}
          accessibilityRole="button"
          accessibilityLabel={t("syncQueue.snooze.pinAccessibility")}
          style={[
            styles.clearingBadge,
            { backgroundColor: statusColor + "15", borderColor: statusColor + "40" },
          ]}
        >
          <Feather name="clock" size={11} color={statusColor} />
          <Text style={[styles.clearingText, { color: statusColor }]}>
            {t("syncQueue.clearingIn", { seconds: secondsLeft })}
          </Text>
          <Text style={[styles.clearingHint, { color: statusColor }]}>
            · {t("syncQueue.snooze.tapToKeep")}
          </Text>
        </TouchableOpacity>
      )}
      {isSnoozed && (
        <View style={styles.snoozedRow}>
          <TouchableOpacity
            onPress={() => handleToggleSnooze(item)}
            accessibilityRole="button"
            accessibilityLabel={t("syncQueue.snooze.unpinAccessibility")}
            style={[
              styles.clearingBadge,
              { backgroundColor: statusColor + "20", borderColor: statusColor + "60", flex: 1 },
            ]}
          >
            <Feather name="bookmark" size={11} color={statusColor} />
            <Text style={[styles.clearingText, { color: statusColor }]}>
              {item.completedAt
                ? t("syncQueue.snooze.pinnedFor", {
                    time: formatElapsed(now - new Date(item.completedAt).getTime(), t),
                  })
                : t("syncQueue.snooze.pinned")}
            </Text>
            <Text style={[styles.clearingHint, { color: statusColor }]}>
              · {t("syncQueue.snooze.tapToRelease")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDismiss(item)}
            accessibilityRole="button"
            accessibilityLabel={t("syncQueue.snooze.dismissAccessibility")}
            style={[
              styles.dismissBtn,
              { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" },
            ]}
          >
            <Feather name="x" size={13} color={colors.destructive} />
            <Text style={[styles.dismissText, { color: colors.destructive }]}>
              {t("syncQueue.snooze.dismiss")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {(item.status === "queued" || item.status === "failed") && (
        <View style={styles.cardActions}>
          {item.status === "failed" && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary }]} onPress={() => handleRetry(item)}>
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>{t("syncQueue.retry")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.destructive + "15" }]} onPress={() => handleCancel(item)}>
            <Feather name="x" size={14} color={colors.destructive} />
            <Text style={[styles.actionText, { color: colors.destructive }]}>{t("syncQueue.cancel")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    );
  };

  const completedCount = filterCounts.done;
  const failedCount = filterCounts.failed;
  const isFiltered = filter !== "all";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.syncBtn, { backgroundColor: colors.primary, opacity: isSyncing ? 0.7 : 1 }]}
          onPress={syncNow}
          disabled={isSyncing}
        >
          <Feather name="refresh-cw" size={16} color="#fff" />
          <Text style={styles.syncText}>{isSyncing ? t("syncQueue.syncing") : t("syncQueue.syncNow")}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {failedCount > 0 && (
            <TouchableOpacity onPress={handleRetryAllFailed} accessibilityRole="button">
              <Text style={[styles.headerActionText, { color: colors.destructive }]}>
                {t("syncQueue.retryAllFailed", { count: failedCount })}
              </Text>
            </TouchableOpacity>
          )}
          {completedCount > 0 && (
            <TouchableOpacity onPress={handleClearCompleted}>
              <Text style={[styles.headerActionText, { color: colors.primary }]}>{t("syncQueue.clearDone")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_ORDER.map((key) => {
          const selected = key === filter;
          const count = filterCounts[key];
          return (
            <TouchableOpacity
              key={key}
              onPress={() => handleSelectFilter(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: selected ? "#fff" : colors.foreground },
                ]}
              >
                {t(`syncQueue.filter.${key}`)}
                {count > 0 ? ` · ${count}` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        scrollEnabled={visibleItems.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isFiltered ? t("syncQueue.noMatches") : t("syncQueue.queueEmpty")}
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {isFiltered ? t("syncQueue.tryDifferentFilter") : t("syncQueue.offlineActions")}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  syncText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  headerActionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  filterPillText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardStatus: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" as const },
  cardTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardError: { fontSize: 12, fontFamily: "Inter_400Regular" },
  clearingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
  },
  clearingText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  clearingHint: { fontSize: 11, fontFamily: "Inter_400Regular", opacity: 0.85 },
  snoozedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  dismissBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dismissText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  actionText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
