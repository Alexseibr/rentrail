import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { getAccessToken, getCompanyId } from "@/services/api";
import { useNetwork } from "@/services/network";
import { enqueue } from "@/services/sync-queue";
import { isQueueable } from "@/services/offline-policy";
import { useSync } from "@/contexts/SyncContext";
import { MediaAttachments } from "@/components/MediaAttachments";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function fetchAsset(id: string) {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return null;

  const res = await fetch(`${BASE_URL}/api/assets/${id}`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

interface TelemetrySnapshot {
  lockState: string | null;
  alarmState: string | null;
  onlineState: string | null;
  batteryPercent: number | null;
  speed: number | null;
  odometer: number | null;
  recordedAt: string | null;
}

async function fetchTelemetry(id: string): Promise<TelemetrySnapshot | null> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return null;

  const res = await fetch(`${BASE_URL}/api/telemetry/assets/${id}/latest`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

type VehicleCommand = "lock" | "unlock" | "arm" | "disarm";

const COMMAND_ENDPOINTS: Record<VehicleCommand, string> = {
  lock: "lock",
  unlock: "unlock",
  arm: "alarm/arm",
  disarm: "alarm/disarm",
};

export default function AssetDetailScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { companyId } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { isConnected } = useNetwork();
  const { queueItems } = useSync();
  const [commanding, setCommanding] = useState<VehicleCommand | null>(null);

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id!),
    enabled: !!id,
  });

  const { data: telemetry } = useQuery({
    queryKey: ["asset-telemetry", id],
    queryFn: () => fetchTelemetry(id!),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const lockStateKnown = telemetry != null && telemetry.lockState != null;
  const alarmStateKnown = telemetry != null && telemetry.alarmState != null;
  const isLocked = telemetry?.lockState === "locked";
  const isArmed = telemetry?.alarmState === "armed";

  const handleCommand = (command: VehicleCommand, label: string) => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const endpoint = `/api/assets/${id}/${COMMAND_ENDPOINTS[command]}`;
    const pendingItem = queueItems.find(
      (item) =>
        item.actionType === "vehicle_command" &&
        item.endpoint === endpoint &&
        (item.status === "queued" || item.status === "syncing" || item.status === "failed"),
    );
    const queuedRetries = pendingItem?.retryCount ?? 0;
    const confirmMsg =
      queuedRetries > 0
        ? t("assetDetail.confirmCommandWithRetries", { command: label, retries: queuedRetries })
        : t("assetDetail.confirmCommand", { command: label });

    Alert.alert(t("assetDetail.confirmCommandTitle"), confirmMsg, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          if (!isConnected && isQueueable("vehicle_command")) {
            try {
              await enqueue({
                actionType: "vehicle_command",
                payload: { assetId: id, command },
                endpoint,
                method: "POST",
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSnackbar(t("assetDetail.commandQueued"), "success");
            } catch {
              showSnackbar(t("assetDetail.commandFailed"), "error");
            }
            return;
          }

          setCommanding(command);
          try {
            const token = await getAccessToken();
            const res = await fetch(`${BASE_URL}${endpoint}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "x-company-id": companyId ?? "",
              },
            });
            if (res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSnackbar(t("assetDetail.commandSent"), "success");
            } else {
              const json = await res.json().catch(() => ({}));
              showSnackbar(json?.error?.message ?? t("assetDetail.commandFailed"), "error");
            }
          } catch (err: unknown) {
            const isNetworkError =
              err instanceof TypeError ||
              (err instanceof Error && /network|fetch|failed to fetch/i.test(err.message));

            if (isNetworkError && isQueueable("vehicle_command")) {
              try {
                await enqueue({
                  actionType: "vehicle_command",
                  payload: { assetId: id, command },
                  endpoint,
                  method: "POST",
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showSnackbar(t("assetDetail.commandQueued"), "success");
              } catch {
                showSnackbar(t("assetDetail.commandFailed"), "error");
              }
            } else {
              showSnackbar(t("assetDetail.commandFailed"), "error");
            }
          } finally {
            setCommanding(null);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("assetDetail.notFound")}</Text>
      </View>
    );
  }

  const fields = [
    { label: t("assetDetail.type"), value: asset.assetType },
    { label: t("assetDetail.brand"), value: asset.brand },
    { label: t("assetDetail.model"), value: asset.model },
    { label: t("assetDetail.serial"), value: asset.serialNumber },
    { label: t("assetDetail.internalCode"), value: asset.internalCode },
    { label: t("assetDetail.qrCode"), value: asset.qrCode },
    { label: t("assetDetail.status"), value: asset.status },
  ].filter((f) => f.value);

  const lockCommand: VehicleCommand = isLocked ? "unlock" : "lock";
  const lockLabel = isLocked ? t("assetDetail.commandUnlock") : t("assetDetail.commandLock");
  const lockIcon = isLocked ? "unlock" : "lock";

  const alarmCommand: VehicleCommand = isArmed ? "disarm" : "arm";
  const alarmLabel = isArmed ? t("assetDetail.commandDisarm") : t("assetDetail.commandArm");
  const alarmIcon = isArmed ? "shield-off" : "shield";

  const unknownStateButtons: { command: VehicleCommand; labelKey: string; icon: string }[] = [
    { command: "lock", labelKey: "assetDetail.commandLock", icon: "lock" },
    { command: "unlock", labelKey: "assetDetail.commandUnlock", icon: "unlock" },
    { command: "arm", labelKey: "assetDetail.commandArm", icon: "shield" },
    { command: "disarm", labelKey: "assetDetail.commandDisarm", icon: "shield-off" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.statusBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.statusText, { color: colors.primary }]}>{asset.status}</Text>
          </View>
          <Text style={[styles.assetTitle, { color: colors.foreground }]}>
            {asset.brand ?? asset.assetType} {asset.model ?? ""}
          </Text>
          <Text style={[styles.assetSub, { color: colors.mutedForeground }]}>
            {asset.internalCode ?? asset.id.slice(0, 8)}
          </Text>
        </View>

        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {fields.map((f) => (
            <View key={f.label} style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
              <Text style={[styles.fieldValue, { color: colors.foreground }]}>{f.value}</Text>
            </View>
          ))}
        </View>

        <MediaAttachments entityType="asset" entityId={id!} />

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/create-incident")}
          >
            <Feather name="alert-circle" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t("assetDetail.reportIssue")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/create-maintenance")}
          >
            <Feather name="tool" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t("assetDetail.maintenance")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t("assetDetail.vehicleControls")}</Text>

        {(lockStateKnown || alarmStateKnown) && (
          <View style={styles.stateRow}>
            {lockStateKnown && (
              <View style={[styles.stateItem, { backgroundColor: isLocked ? "#E8F5E9" : "#FFEBEE" }]}>
                <Feather
                  name={isLocked ? "lock" : "unlock"}
                  size={15}
                  color={isLocked ? "#2E7D32" : "#C62828"}
                />
                <Text style={[styles.stateText, { color: isLocked ? "#2E7D32" : "#C62828" }]}>
                  {isLocked ? t("assetDetail.locked") : t("assetDetail.unlocked")}
                </Text>
              </View>
            )}
            {alarmStateKnown && (
              <View style={[styles.stateItem, { backgroundColor: isArmed ? "#E8F5E9" : "#FFF3E0" }]}>
                <Feather
                  name={isArmed ? "shield" : "shield-off"}
                  size={15}
                  color={isArmed ? "#2E7D32" : "#E65100"}
                />
                <Text style={[styles.stateText, { color: isArmed ? "#2E7D32" : "#E65100" }]}>
                  {isArmed ? t("assetDetail.armed") : t("assetDetail.disarmed")}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.commandsGrid}>
          {lockStateKnown ? (
            <TouchableOpacity
              style={[styles.commandBtn, {
                backgroundColor: isLocked ? "#FFEBEE" : colors.card,
                borderColor: colors.border,
              }]}
              onPress={() => handleCommand(lockCommand, lockLabel)}
              disabled={!!commanding}
              activeOpacity={0.7}
            >
              {commanding === "lock" || commanding === "unlock" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name={lockIcon as any} size={20} color={isLocked ? "#C62828" : colors.foreground} />
              )}
              <Text style={[styles.commandText, { color: isLocked ? "#C62828" : colors.foreground }]}>
                {lockLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {(["lock", "unlock"] as VehicleCommand[]).map((cmd) => {
                const btn = unknownStateButtons.find((b) => b.command === cmd)!;
                return (
                  <TouchableOpacity
                    key={cmd}
                    style={[styles.commandBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleCommand(cmd, t(btn.labelKey))}
                    disabled={!!commanding}
                    activeOpacity={0.7}
                  >
                    {commanding === cmd ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name={btn.icon as any} size={20} color={colors.foreground} />
                    )}
                    <Text style={[styles.commandText, { color: colors.foreground }]}>{t(btn.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {alarmStateKnown ? (
            <TouchableOpacity
              style={[styles.commandBtn, {
                backgroundColor: isArmed ? "#FFF3E0" : "#E8F5E9",
                borderColor: colors.border,
              }]}
              onPress={() => handleCommand(alarmCommand, alarmLabel)}
              disabled={!!commanding}
              activeOpacity={0.7}
            >
              {commanding === "arm" || commanding === "disarm" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name={alarmIcon as any} size={20} color={isArmed ? "#E65100" : "#2E7D32"} />
              )}
              <Text style={[styles.commandText, { color: isArmed ? "#E65100" : "#2E7D32" }]}>
                {alarmLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {(["arm", "disarm"] as VehicleCommand[]).map((cmd) => {
                const btn = unknownStateButtons.find((b) => b.command === cmd)!;
                return (
                  <TouchableOpacity
                    key={cmd}
                    style={[styles.commandBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleCommand(cmd, t(btn.labelKey))}
                    disabled={!!commanding}
                    activeOpacity={0.7}
                  >
                    {commanding === cmd ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name={btn.icon as any} size={20} color={colors.foreground} />
                    )}
                    <Text style={[styles.commandText, { color: colors.foreground }]}>{t(btn.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>

        {telemetry?.recordedAt && (
          <Text style={[styles.lastUpdate, { color: colors.mutedForeground }]}>
            {t("assetDetail.lastUpdate")}: {new Date(telemetry.recordedAt).toLocaleString()}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  headerCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 6 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  assetTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  assetSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  detailCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  actionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1, marginTop: 4, marginLeft: 4 },
  stateRow: { flexDirection: "row", gap: 8 },
  stateItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  stateText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  commandsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  commandBtn: { flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  commandText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  lastUpdate: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },
});
