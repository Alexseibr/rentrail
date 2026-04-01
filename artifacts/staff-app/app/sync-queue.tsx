import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useSync } from "@/contexts/SyncContext";
import { cancelItem, retryItem, clearCompleted } from "@/services/sync-queue";
import { getActionDescription } from "@/services/offline-policy";
import type { QueueItem } from "@/services/sync-queue";

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

export default function SyncQueueScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { queueItems, isSyncing, syncNow } = useSync();

  const handleCancel = (item: QueueItem) => {
    Alert.alert(t("syncQueue.cancelAction"), t("syncQueue.cancelConfirm", { action: getActionDescription(item.actionType) }), [
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

  const handleClearCompleted = async () => {
    await clearCompleted();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderItem = ({ item }: { item: QueueItem }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Feather
          name={(STATUS_ICONS[item.status] ?? "circle") as any}
          size={18}
          color={STATUS_COLORS[item.status] ?? colors.mutedForeground}
        />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {getActionDescription(item.actionType)}
        </Text>
        <Text style={[styles.cardStatus, { color: STATUS_COLORS[item.status] ?? colors.mutedForeground }]}>
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

  const completedCount = queueItems.filter((i) => i.status === "completed" || i.status === "canceled").length;

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
        {completedCount > 0 && (
          <TouchableOpacity onPress={handleClearCompleted}>
            <Text style={[styles.clearText, { color: colors.primary }]}>{t("syncQueue.clearDone")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={queueItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        scrollEnabled={queueItems.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("syncQueue.queueEmpty")}</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {t("syncQueue.offlineActions")}
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
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  syncText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clearText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardStatus: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "capitalize" as const },
  cardTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardError: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  actionText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
