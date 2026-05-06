import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, Share,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { getAccessToken } from "@/services/api";
import { useNetwork } from "@/services/network";
import { enqueue } from "@/services/sync-queue";
import { isQueueable } from "@/services/offline-policy";
import { useAppStateFocus } from "@/hooks/useAppStateFocus";
import { readCoordsFromCache } from "@/services/coordsCache";
import { type CachedCoordinates } from "@/hooks/useCachedCoordinates";
import { MiniMapPreview } from "@/components/MiniMapPreview";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const YELLOW = "#F5C518";

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  assigned: "#3b82f6",
  en_route: "#8b5cf6",
  in_progress: "#f59e0b",
  waiting_parts: "#ef4444",
  completed: "#22c55e",
  canceled: "#94a3b8",
};

const STATUS_FLOW: Record<string, string | null> = {
  draft: "assigned",
  assigned: "en_route",
  en_route: "in_progress",
  in_progress: "completed",
  waiting_parts: "in_progress",
  completed: null,
  canceled: null,
};

function openMaps(lat: number, lng: number) {
  const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
  const webUrl = `https://maps.google.com/?q=${lat},${lng}`;
  Linking.canOpenURL(geoUrl)
    .then((ok) => Linking.openURL(ok ? geoUrl : webUrl))
    .catch(() => Linking.openURL(webUrl).catch(() => {}));
}

async function fetchWorkOrder(companyId: string, id: string) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/work-orders/${id}`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Not found");
  return (await res.json()).data;
}

async function updateStatus(companyId: string, id: string, status: string, extra?: object) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/work-orders/${id}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-company-id": companyId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, ...extra }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return (await res.json()).data;
}

export default function MaintenanceTaskDetailScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { isConnected } = useNetwork();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cachedCoords, setCachedCoords] = useState<CachedCoordinates | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !id) return;
    try {
      const data = await fetchWorkOrder(companyId, id);
      setOrder(data);
      if (data.assetId) {
        const coords = await readCoordsFromCache(data.assetId);
        setCachedCoords(coords);
      } else {
        setCachedCoords(null);
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  const refreshCoords = useCallback(async () => {
    if (!order?.assetId) return;
    const coords = await readCoordsFromCache(order.assetId);
    setCachedCoords(coords);
  }, [order?.assetId]);

  React.useEffect(() => { load(); }, [load]);

  useAppStateFocus(refreshCoords);

  const queueStatusChange = async (newStatus: string, extra?: Record<string, unknown>) => {
    await enqueue({
      actionType: "change_maintenance_status",
      payload: { status: newStatus, ...extra },
      endpoint: `/api/work-orders/${order.id}/status`,
      method: "POST",
    });
    setOrder((prev: any) => prev ? { ...prev, status: newStatus } : prev);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSnackbar(t("maintenance.statusQueued"), "success");
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!companyId || !order) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (newStatus === "completed") {
      const doComplete = async (resolution: string) => {
        const extra = { resolution, actualCost: order.estimatedCost };

        if (!isConnected && isQueueable("change_maintenance_status")) {
          try {
            await queueStatusChange("completed", extra);
          } catch {
            showSnackbar(t("toast.actionFailed"), "error");
          }
          return;
        }

        setActionLoading(true);
        try {
          await updateStatus(companyId, order.id, "completed", extra);
          await load();
          showSnackbar(t("maintenance.taskCompleted"), "success");
        } catch (err: unknown) {
          const isNetworkError =
            err instanceof TypeError ||
            (err instanceof Error && /network|fetch|failed to fetch/i.test(err.message));

          if (isNetworkError && isQueueable("change_maintenance_status")) {
            try {
              await queueStatusChange("completed", extra);
            } catch {
              showSnackbar(t("toast.actionFailed"), "error");
            }
          } else {
            const msg = err instanceof Error ? err.message : t("toast.actionFailed");
            showSnackbar(msg, "error");
          }
        } finally {
          setActionLoading(false);
        }
      };

      Alert.prompt
        ? Alert.prompt(
            t("serviceModule.completeOrder"),
            t("serviceModule.enterResolution"),
            (resolution) => doComplete(resolution ?? ""),
          )
        : Alert.alert(
            t("serviceModule.completeOrder"),
            t("serviceModule.completeConfirm"),
            [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("serviceModule.complete"), onPress: () => doComplete("") },
            ],
          );
      return;
    }

    if (!isConnected && isQueueable("change_maintenance_status")) {
      try {
        await queueStatusChange(newStatus);
      } catch {
        showSnackbar(t("toast.actionFailed"), "error");
      }
      return;
    }

    setActionLoading(true);
    try {
      await updateStatus(companyId, order.id, newStatus);
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSnackbar(t("toast.statusChanged"), "success");
    } catch (err: unknown) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error && /network|fetch|failed to fetch/i.test(err.message));

      if (isNetworkError && isQueueable("change_maintenance_status")) {
        try {
          await queueStatusChange(newStatus);
        } catch {
          showSnackbar(t("toast.actionFailed"), "error");
        }
      } else {
        const msg = err instanceof Error ? err.message : t("toast.actionFailed");
        showSnackbar(msg, "error");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
          {t("serviceModule.orderNotFound")}
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 12, fontFamily: "Inter_600SemiBold" }}>
            {t("common.back")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextStatus = STATUS_FLOW[order.status];
  const statusColor = STATUS_COLORS[order.status] ?? "#94a3b8";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.dark }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{order.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.statusCard, { backgroundColor: statusColor + "18", borderColor: statusColor + "40" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {t(`serviceModule.status_${order.status}`, { defaultValue: order.status })}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Row
            label={t("serviceModule.type")}
            value={t(`serviceModule.type_${order.orderType}`, { defaultValue: order.orderType })}
            colors={colors}
          />
          <Row
            label={t("serviceModule.priority")}
            value={t(`serviceModule.priority_${order.priority}`, { defaultValue: order.priority })}
            colors={colors}
          />
          {order.assetCode && (
            <Row
              label={t("serviceModule.asset")}
              value={`${order.assetCode}${order.assetBrand ? ` · ${order.assetBrand} ${order.assetModel ?? ""}` : ""}`}
              colors={colors}
            />
          )}
          {order.assignedToName?.trim() && (
            <Row label={t("serviceModule.mechanic")} value={order.assignedToName} colors={colors} />
          )}
          {order.branchName && (
            <Row label={t("serviceModule.branch")} value={order.branchName} colors={colors} />
          )}
          {order.estimatedCost && (
            <Row
              label={t("serviceModule.estimatedCost")}
              value={`${parseFloat(order.estimatedCost).toLocaleString("ru-RU")} ₽`}
              colors={colors}
            />
          )}
        </View>

        {cachedCoords ? (
          <View style={styles.miniMapWrapper}>
            <MiniMapPreview
              lat={cachedCoords.lat}
              lng={cachedCoords.lng}
              isLastKnown
              label={
                cachedCoords.cachedAt
                  ? t("incidentDetail.assetLocationLastKnown", {
                      time: (() => {
                        const diff = Date.now() - new Date(cachedCoords.cachedAt).getTime();
                        const minutes = Math.floor(diff / 60000);
                        if (minutes < 1) return t("rentalDetail.timeJustNow", { defaultValue: "just now" });
                        if (minutes < 60) return t("rentalDetail.timeMinutesAgo", { count: minutes, defaultValue: `${minutes}m ago` });
                        const hours = Math.floor(minutes / 60);
                        if (hours < 24) return t("rentalDetail.timeHoursAgo", { count: hours, defaultValue: `${hours}h ago` });
                        return t("rentalDetail.timeDaysAgo", { count: Math.floor(hours / 24), defaultValue: `${Math.floor(hours / 24)}d ago` });
                      })(),
                      defaultValue: "Last seen {{time}}",
                    })
                  : t("incidentDetail.assetLocation", { defaultValue: "Asset location" })
              }
              onPress={() => openMaps(cachedCoords.lat, cachedCoords.lng)}
              onCopy={() => {
                Share.share({
                  message: `${cachedCoords.lat.toFixed(5)}, ${cachedCoords.lng.toFixed(5)}`,
                }).catch(() => {});
              }}
            />
          </View>
        ) : null}

        {order.description ? (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("serviceModule.description")}
            </Text>
            <Text style={[styles.descText, { color: colors.foreground }]}>{order.description}</Text>
          </View>
        ) : null}

        {order.resolution ? (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("serviceModule.resolution")}
            </Text>
            <Text style={[styles.descText, { color: colors.foreground }]}>{order.resolution}</Text>
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("serviceModule.timeline")}
          </Text>
          {order.startedAt && (
            <Row label={t("serviceModule.started")} value={new Date(order.startedAt).toLocaleString("ru-RU")} colors={colors} />
          )}
          {order.completedAt && (
            <Row label={t("serviceModule.completed")} value={new Date(order.completedAt).toLocaleString("ru-RU")} colors={colors} />
          )}
          <Row label={t("serviceModule.created")} value={new Date(order.createdAt).toLocaleString("ru-RU")} colors={colors} />
        </View>

        {nextStatus && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: YELLOW }]}
            onPress={() => handleStatusChange(nextStatus)}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather
                  name={isConnected ? "arrow-right-circle" : "clock"}
                  size={20}
                  color="#000"
                />
                <Text style={styles.actionBtnText}>
                  {t(`serviceModule.moveTo_${nextStatus}`, {
                    defaultValue: t(`serviceModule.status_${nextStatus}`, { defaultValue: nextStatus }),
                  })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff", textAlign: "center" },
  scroll: { padding: 16, paddingBottom: 40 },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 14,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  section: { borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#00000010",
  },
  rowLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 12 },
  descText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  miniMapWrapper: {
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    padding: 16, borderRadius: 16, marginTop: 8,
  },
  actionBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
});
