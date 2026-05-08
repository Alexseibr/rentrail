import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Animated,
  Linking,
  Share,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useCachedCoordinates } from "@/hooks/useCachedCoordinates";
import { MiniMapPreview } from "@/components/MiniMapPreview";

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
  lat: number | null;
  lng: number | null;
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

async function fetchAssetCommands(id: string) {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return [];

  const res = await fetch(`${BASE_URL}/api/assets/${id}/commands`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return [];
  const { data } = await res.json();
  return data as Array<{
    id: string;
    commandType: string;
    status: string;
    queuedAt: string;
    sentAt: string | null;
    acknowledgedAt: string | null;
    failedAt: string | null;
    errorMessage: string | null;
  }>;
}

type VehicleCommand = "lock" | "unlock" | "arm" | "disarm";

const COMMAND_ENDPOINTS: Record<VehicleCommand, string> = {
  lock: "lock",
  unlock: "unlock",
  arm: "alarm/arm",
  disarm: "alarm/disarm",
};

function getBatteryColor(pct: number): string {
  if (pct <= 20) return "#EF4444";
  if (pct <= 40) return "#F97316";
  if (pct <= 70) return "#EAB308";
  return "#22C55E";
}

function BatteryIcon({
  percent,
  size = 20,
}: {
  percent: number;
  size?: number;
}) {
  const safe = Math.min(100, Math.max(0, percent));
  const color = getBatteryColor(safe);
  const bodyWidth = size * 1.6;
  const bodyHeight = size * 0.8;
  const borderRadius = size * 0.12;
  const borderWidth = size * 0.08;
  const terminalWidth = size * 0.12;
  const terminalHeight = bodyHeight * 0.4;
  const innerWidth = bodyWidth - borderWidth * 2;
  const innerHeight = bodyHeight - borderWidth * 2;
  const fillWidth = (safe / 100) * innerWidth;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          borderRadius,
          borderWidth,
          borderColor: color,
          justifyContent: "center",
          alignItems: "flex-start",
          padding: borderWidth,
        }}
      >
        <View
          style={{
            width: fillWidth,
            height: innerHeight,
            borderRadius: borderRadius * 0.5,
            backgroundColor: color,
          }}
        />
      </View>
      <View
        style={{
          width: terminalWidth,
          height: terminalHeight,
          backgroundColor: color,
          borderTopRightRadius: size * 0.06,
          borderBottomRightRadius: size * 0.06,
        }}
      />
    </View>
  );
}

const STATUS_ICON: Record<string, { name: string; color: string }> = {
  queued: { name: "clock", color: "#F59E0B" },
  sent: { name: "send", color: "#3B82F6" },
  acknowledged: { name: "check-circle", color: "#10B981" },
  failed: { name: "x-circle", color: "#EF4444" },
  expired: { name: "alert-circle", color: "#9CA3AF" },
  canceled: { name: "slash", color: "#9CA3AF" },
};

function formatRelativeTime(
  iso: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("assetDetail.timeJustNow");
  if (minutes < 60) return t("assetDetail.timeMinutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("assetDetail.timeHoursAgo", { count: hours });
  return t("assetDetail.timeDaysAgo", { count: Math.floor(hours / 24) });
}

export default function AssetDetailScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { companyId } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { isConnected } = useNetwork();
  const { queueItems } = useSync();
  const queryClient = useQueryClient();
  const [commanding, setCommanding] = useState<VehicleCommand | null>(null);
  const [commandsExpanded, setCommandsExpanded] = useState(true);
  const [commandFilter, setCommandFilter] = useState<
    "all" | "failed" | "acknowledged"
  >("all");
  const [refreshingTelemetry, setRefreshingTelemetry] = useState(false);
  const prevTelemetryFetching = useRef(false);
  const fastPollUntilRef = useRef<number>(0);

  const { cachedCoords, saveCoords } = useCachedCoordinates(id);

  const skeletonOpacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [skeletonOpacity]);

  const stateOpacity = useRef(new Animated.Value(1)).current;

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id!),
    enabled: !!id,
  });

  const {
    data: telemetry,
    isLoading: isTelemetryLoading,
    isFetching: telemetryFetching,
  } = useQuery({
    queryKey: ["asset-telemetry", id],
    queryFn: () => fetchTelemetry(id!),
    enabled: !!id,
    refetchInterval: () =>
      Date.now() < fastPollUntilRef.current ? 5000 : 15000,
  });

  const fetchCommands = useCallback(() => fetchAssetCommands(id!), [id]);

  const {
    data: commands = [],
    isLoading: commandsLoading,
    refetch: refetchCommands,
  } = useQuery({
    queryKey: ["asset-commands", id],
    queryFn: fetchCommands,
    enabled: !!id,
    refetchInterval: () =>
      Date.now() < fastPollUntilRef.current ? 5000 : 15000,
  });

  useEffect(() => {
    if (telemetry?.lat != null && telemetry?.lng != null) {
      saveCoords(telemetry.lat, telemetry.lng);
    }
  }, [telemetry, saveCoords]);

  useEffect(() => {
    if (
      prevTelemetryFetching.current &&
      !telemetryFetching &&
      refreshingTelemetry
    ) {
      setRefreshingTelemetry(false);
    }
    prevTelemetryFetching.current = telemetryFetching;
  }, [telemetryFetching, refreshingTelemetry]);

  useEffect(() => {
    if (refreshingTelemetry) {
      stateOpacity.setValue(0.4);
    } else {
      Animated.timing(stateOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [refreshingTelemetry, stateOpacity]);

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
        (item.status === "queued" ||
          item.status === "syncing" ||
          item.status === "failed"),
    );
    const queuedRetries = pendingItem?.retryCount ?? 0;
    const confirmMsg =
      queuedRetries > 0
        ? t("assetDetail.confirmCommandWithRetries", {
            command: label,
            retries: queuedRetries,
          })
        : t("assetDetail.confirmCommand", { command: label });

    Alert.alert(t("assetDetail.confirmCommandTitle"), confirmMsg, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          if (!isConnected && isQueueable("vehicle_command")) {
            fastPollUntilRef.current = Date.now() + 30000;
            queryClient.setQueryData(
              ["fleet-fast-poll-until"],
              Date.now() + 30000,
            );
            const offlineOptimisticId = `optimistic-${Date.now()}`;
            queryClient.setQueryData<typeof commands>(
              ["asset-commands", id],
              (prev = []) => [
                {
                  id: offlineOptimisticId,
                  commandType: command,
                  status: "queued",
                  queuedAt: new Date().toISOString(),
                  sentAt: null,
                  acknowledgedAt: null,
                  failedAt: null,
                  errorMessage: null,
                },
                ...prev,
              ],
            );
            try {
              await enqueue({
                actionType: "vehicle_command",
                payload: { assetId: id, command },
                endpoint,
                method: "POST",
              });
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              showSnackbar(t("assetDetail.commandQueued"), "success");
            } catch {
              queryClient.setQueryData<typeof commands>(
                ["asset-commands", id],
                (prev = []) => prev.filter((c) => c.id !== offlineOptimisticId),
              );
              showSnackbar(t("assetDetail.commandFailed"), "error");
            }
            return;
          }

          fastPollUntilRef.current = Date.now() + 30000;
          queryClient.setQueryData(
            ["fleet-fast-poll-until"],
            Date.now() + 30000,
          );
          const optimisticId = `optimistic-${Date.now()}`;
          queryClient.setQueryData<typeof commands>(
            ["asset-commands", id],
            (prev = []) => [
              {
                id: optimisticId,
                commandType: command,
                status: "queued",
                queuedAt: new Date().toISOString(),
                sentAt: null,
                acknowledgedAt: null,
                failedAt: null,
                errorMessage: null,
              },
              ...prev,
            ],
          );

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
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              showSnackbar(t("assetDetail.commandSent"), "success");
              setRefreshingTelemetry(true);
              try {
                await refetchCommands();
              } catch {
                queryClient.setQueryData<typeof commands>(
                  ["asset-commands", id],
                  (prev = []) => prev.filter((c) => c.id !== optimisticId),
                );
              }
              setTimeout(() => {
                queryClient.invalidateQueries({
                  queryKey: ["asset-telemetry", id],
                });
              }, 3000);
            } else {
              const json = await res.json().catch(() => ({}));
              queryClient.setQueryData<typeof commands>(
                ["asset-commands", id],
                (prev = []) => prev.filter((c) => c.id !== optimisticId),
              );
              showSnackbar(
                json?.error?.message ?? t("assetDetail.commandFailed"),
                "error",
              );
            }
          } catch (err: unknown) {
            const isNetworkError =
              err instanceof TypeError ||
              (err instanceof Error &&
                /network|fetch|failed to fetch/i.test(err.message));

            if (isNetworkError && isQueueable("vehicle_command")) {
              try {
                await enqueue({
                  actionType: "vehicle_command",
                  payload: { assetId: id, command },
                  endpoint,
                  method: "POST",
                });
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                showSnackbar(t("assetDetail.commandQueued"), "success");
              } catch {
                queryClient.setQueryData<typeof commands>(
                  ["asset-commands", id],
                  (prev = []) => prev.filter((c) => c.id !== optimisticId),
                );
                showSnackbar(t("assetDetail.commandFailed"), "error");
              }
            } else {
              queryClient.setQueryData<typeof commands>(
                ["asset-commands", id],
                (prev = []) => prev.filter((c) => c.id !== optimisticId),
              );
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
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {t("assetDetail.notFound")}
        </Text>
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

  const filteredCommands = commands.filter((cmd) => {
    if (commandFilter === "failed") return cmd.status === "failed";
    if (commandFilter === "acknowledged") return cmd.status === "acknowledged";
    return true;
  });

  const lockCommand: VehicleCommand = isLocked ? "unlock" : "lock";
  const lockLabel = isLocked
    ? t("assetDetail.commandUnlock")
    : t("assetDetail.commandLock");
  const lockIcon = isLocked ? "unlock" : "lock";

  const alarmCommand: VehicleCommand = isArmed ? "disarm" : "arm";
  const alarmLabel = isArmed
    ? t("assetDetail.commandDisarm")
    : t("assetDetail.commandArm");
  const alarmIcon = isArmed ? "shield-off" : "shield";

  const unknownStateButtons: {
    command: VehicleCommand;
    labelKey: string;
    icon: string;
  }[] = [
    { command: "lock", labelKey: "assetDetail.commandLock", icon: "lock" },
    {
      command: "unlock",
      labelKey: "assetDetail.commandUnlock",
      icon: "unlock",
    },
    { command: "arm", labelKey: "assetDetail.commandArm", icon: "shield" },
    {
      command: "disarm",
      labelKey: "assetDetail.commandDisarm",
      icon: "shield-off",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          style={[
            styles.headerCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.statusBadge, { backgroundColor: colors.secondary }]}
          >
            <Text style={[styles.statusText, { color: colors.primary }]}>
              {asset.status}
            </Text>
          </View>
          <View style={styles.assetTitleRow}>
            <Text style={[styles.assetTitle, { color: colors.foreground }]}>
              {asset.brand ?? asset.assetType} {asset.model ?? ""}
            </Text>
            {telemetry?.onlineState != null && (
              <View
                style={[
                  styles.headerOnlineDot,
                  {
                    backgroundColor:
                      telemetry.onlineState === "online"
                        ? "#10B981"
                        : telemetry.onlineState === "offline"
                          ? "#EF4444"
                          : "#9CA3AF",
                  },
                ]}
              />
            )}
          </View>
          <Text style={[styles.assetSub, { color: colors.mutedForeground }]}>
            {asset.internalCode ?? asset.id.slice(0, 8)}
          </Text>
        </View>

        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {fields.map((f) => (
            <View
              key={f.label}
              style={[styles.fieldRow, { borderBottomColor: colors.border }]}
            >
              <Text
                style={[styles.fieldLabel, { color: colors.mutedForeground }]}
              >
                {f.label}
              </Text>
              <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                {f.value}
              </Text>
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
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {t("assetDetail.reportIssue")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("/create-maintenance")}
          >
            <Feather name="tool" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {t("assetDetail.maintenance")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          {t("assetDetail.vehicleControls")}
        </Text>

        <View
          style={[
            styles.telemetryStatsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {isTelemetryLoading ? (
            <>
              {[
                t("assetDetail.onlineState"),
                t("assetDetail.battery"),
                t("assetDetail.speed"),
                t("assetDetail.odometer"),
              ].map((label, i, arr) => (
                <View
                  key={label}
                  style={[
                    styles.statsRow,
                    i < arr.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statsLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {label}
                  </Text>
                  <Animated.View
                    style={[
                      styles.skeletonPill,
                      {
                        backgroundColor: colors.border,
                        opacity: skeletonOpacity,
                      },
                    ]}
                  />
                </View>
              ))}
            </>
          ) : !telemetry ? (
            <View style={styles.statsEmpty}>
              <Text
                style={[styles.noDeviceHint, { color: colors.mutedForeground }]}
              >
                {t("assetDetail.noDeviceData")}
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.statsRow,
                  { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.statsLabel, { color: colors.mutedForeground }]}
                >
                  {t("assetDetail.onlineState")}
                </Text>
                {telemetry.onlineState != null ? (
                  <View style={styles.onlineStateBadge}>
                    <View
                      style={[
                        styles.onlineDot,
                        {
                          backgroundColor:
                            telemetry.onlineState === "online"
                              ? "#10B981"
                              : telemetry.onlineState === "offline"
                                ? "#EF4444"
                                : "#9CA3AF",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statsValue,
                        {
                          color:
                            telemetry.onlineState === "online"
                              ? "#10B981"
                              : telemetry.onlineState === "offline"
                                ? "#EF4444"
                                : colors.mutedForeground,
                        },
                      ]}
                    >
                      {t(`assetDetail.onlineState_${telemetry.onlineState}`, {
                        defaultValue: telemetry.onlineState,
                      })}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[styles.statsValue, { color: colors.foreground }]}
                  >
                    —
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statsRow,
                  { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.statsLabel, { color: colors.mutedForeground }]}
                >
                  {t("assetDetail.battery")}
                </Text>
                {telemetry.batteryPercent != null ? (
                  <View style={styles.batteryValueRow}>
                    <BatteryIcon percent={telemetry.batteryPercent} size={18} />
                    <Text
                      style={[
                        styles.statsValue,
                        {
                          color: getBatteryColor(telemetry.batteryPercent),
                          marginLeft: 6,
                        },
                      ]}
                    >
                      {telemetry.batteryPercent}%
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[styles.statsValue, { color: colors.foreground }]}
                  >
                    —
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statsRow,
                  { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.statsLabel, { color: colors.mutedForeground }]}
                >
                  {t("assetDetail.speed")}
                </Text>
                <Text style={[styles.statsValue, { color: colors.foreground }]}>
                  {telemetry.speed != null ? `${telemetry.speed} km/h` : "—"}
                </Text>
              </View>
              <View style={styles.statsRow}>
                <Text
                  style={[styles.statsLabel, { color: colors.mutedForeground }]}
                >
                  {t("assetDetail.odometer")}
                </Text>
                <Text style={[styles.statsValue, { color: colors.foreground }]}>
                  {telemetry.odometer != null
                    ? `${telemetry.odometer.toLocaleString()} km`
                    : "—"}
                </Text>
              </View>
            </>
          )}
        </View>

        {(() => {
          const liveLat = telemetry?.lat ?? null;
          const liveLng = telemetry?.lng ?? null;
          const hasLiveLocation = liveLat != null && liveLng != null;
          const displayLat = hasLiveLocation
            ? liveLat
            : (cachedCoords?.lat ?? null);
          const displayLng = hasLiveLocation
            ? liveLng
            : (cachedCoords?.lng ?? null);
          const hasLocation = displayLat != null && displayLng != null;
          const isLastKnown = hasLocation && !hasLiveLocation;

          if (!hasLocation) return null;

          const openMaps = () => {
            const lat = displayLat!;
            const lng = displayLng!;
            const mapsUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
            Linking.canOpenURL(mapsUrl)
              .then((supported) => {
                if (supported) return Linking.openURL(mapsUrl);
                Alert.alert(t("common.error"), t("assetDetail.noLocation"));
              })
              .catch(() => {
                Alert.alert(t("common.error"), t("assetDetail.noLocation"));
              });
          };

          const copyCoords = () => {
            Share.share({
              message: `${displayLat!.toFixed(5)}, ${displayLng!.toFixed(5)}`,
            }).catch(() => {});
          };

          return (
            <MiniMapPreview
              lat={displayLat!}
              lng={displayLng!}
              isLastKnown={isLastKnown}
              label={
                isLastKnown
                  ? t("assetDetail.locationLastKnown", {
                      time: formatRelativeTime(cachedCoords!.cachedAt, t),
                    })
                  : t("assetDetail.location")
              }
              onPress={openMaps}
              onCopy={copyCoords}
            />
          );
        })()}

        {refreshingTelemetry && (
          <View style={styles.refreshingRow}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text
              style={[styles.refreshingText, { color: colors.mutedForeground }]}
            >
              {t("assetDetail.refreshing")}
            </Text>
          </View>
        )}

        {(lockStateKnown || alarmStateKnown) && (
          <Animated.View style={[styles.stateRow, { opacity: stateOpacity }]}>
            {lockStateKnown && (
              <View
                style={[
                  styles.stateItem,
                  { backgroundColor: isLocked ? "#E8F5E9" : "#FFEBEE" },
                ]}
              >
                <Feather
                  name={isLocked ? "lock" : "unlock"}
                  size={15}
                  color={isLocked ? "#2E7D32" : "#C62828"}
                />
                <Text
                  style={[
                    styles.stateText,
                    { color: isLocked ? "#2E7D32" : "#C62828" },
                  ]}
                >
                  {isLocked
                    ? t("assetDetail.locked")
                    : t("assetDetail.unlocked")}
                </Text>
              </View>
            )}
            {alarmStateKnown && (
              <View
                style={[
                  styles.stateItem,
                  { backgroundColor: isArmed ? "#E8F5E9" : "#FFF3E0" },
                ]}
              >
                <Feather
                  name={isArmed ? "shield" : "shield-off"}
                  size={15}
                  color={isArmed ? "#2E7D32" : "#E65100"}
                />
                <Text
                  style={[
                    styles.stateText,
                    { color: isArmed ? "#2E7D32" : "#E65100" },
                  ]}
                >
                  {isArmed ? t("assetDetail.armed") : t("assetDetail.disarmed")}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {!isTelemetryLoading && !!telemetry && (
          <View style={styles.commandsGrid}>
            {lockStateKnown ? (
              <TouchableOpacity
                style={[
                  styles.commandBtn,
                  {
                    backgroundColor: isLocked ? "#FFEBEE" : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleCommand(lockCommand, lockLabel)}
                disabled={!!commanding}
                activeOpacity={0.7}
              >
                {commanding === "lock" || commanding === "unlock" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather
                    name={
                      lockIcon as React.ComponentProps<typeof Feather>["name"]
                    }
                    size={20}
                    color={isLocked ? "#C62828" : colors.foreground}
                  />
                )}
                <Text
                  style={[
                    styles.commandText,
                    { color: isLocked ? "#C62828" : colors.foreground },
                  ]}
                >
                  {lockLabel}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                {(["lock", "unlock"] as VehicleCommand[]).map((cmd) => {
                  const btn = unknownStateButtons.find(
                    (b) => b.command === cmd,
                  )!;
                  return (
                    <TouchableOpacity
                      key={cmd}
                      style={[
                        styles.commandBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => handleCommand(cmd, t(btn.labelKey))}
                      disabled={!!commanding}
                      activeOpacity={0.7}
                    >
                      {commanding === cmd ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <Feather
                          name={
                            btn.icon as React.ComponentProps<
                              typeof Feather
                            >["name"]
                          }
                          size={20}
                          color={colors.foreground}
                        />
                      )}
                      <Text
                        style={[
                          styles.commandText,
                          { color: colors.foreground },
                        ]}
                      >
                        {t(btn.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {alarmStateKnown ? (
              <TouchableOpacity
                style={[
                  styles.commandBtn,
                  {
                    backgroundColor: isArmed ? "#FFF3E0" : "#E8F5E9",
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleCommand(alarmCommand, alarmLabel)}
                disabled={!!commanding}
                activeOpacity={0.7}
              >
                {commanding === "arm" || commanding === "disarm" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather
                    name={
                      alarmIcon as React.ComponentProps<typeof Feather>["name"]
                    }
                    size={20}
                    color={isArmed ? "#E65100" : "#2E7D32"}
                  />
                )}
                <Text
                  style={[
                    styles.commandText,
                    { color: isArmed ? "#E65100" : "#2E7D32" },
                  ]}
                >
                  {alarmLabel}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                {(["arm", "disarm"] as VehicleCommand[]).map((cmd) => {
                  const btn = unknownStateButtons.find(
                    (b) => b.command === cmd,
                  )!;
                  return (
                    <TouchableOpacity
                      key={cmd}
                      style={[
                        styles.commandBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => handleCommand(cmd, t(btn.labelKey))}
                      disabled={!!commanding}
                      activeOpacity={0.7}
                    >
                      {commanding === cmd ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <Feather
                          name={
                            btn.icon as React.ComponentProps<
                              typeof Feather
                            >["name"]
                          }
                          size={20}
                          color={colors.foreground}
                        />
                      )}
                      <Text
                        style={[
                          styles.commandText,
                          { color: colors.foreground },
                        ]}
                      >
                        {t(btn.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        )}

        {telemetry?.recordedAt && (
          <Text style={[styles.lastUpdate, { color: colors.mutedForeground }]}>
            {t("assetDetail.lastUpdate")}:{" "}
            {new Date(telemetry.recordedAt).toLocaleString()}
          </Text>
        )}

        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setCommandsExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.mutedForeground, marginTop: 0 },
            ]}
          >
            {t("assetDetail.recentCommands")}
          </Text>
          <Feather
            name={commandsExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>

        {commandsExpanded && (
          <>
            <View style={styles.commandFilterRow}>
              {(["all", "failed", "acknowledged"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.commandFilterChip,
                    commandFilter === f
                      ? { backgroundColor: colors.primary }
                      : {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                  ]}
                  onPress={() => setCommandFilter(f)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.commandFilterChipText,
                      {
                        color:
                          commandFilter === f ? "#fff" : colors.mutedForeground,
                      },
                    ]}
                  >
                    {t(`assetDetail.filterCmd_${f}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View
              style={[
                styles.commandHistoryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {commandsLoading ? (
                <View style={styles.commandHistoryEmpty}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : filteredCommands.length === 0 ? (
                <View style={styles.commandHistoryEmpty}>
                  <Feather
                    name="inbox"
                    size={20}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.commandHistoryEmptyText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {commandFilter === "all"
                      ? t("assetDetail.noRecentCommands")
                      : t("assetDetail.noCommandsForFilter")}
                  </Text>
                </View>
              ) : (
                filteredCommands.map((cmd, index) => {
                  const iconMeta =
                    STATUS_ICON[cmd.status] ?? STATUS_ICON.queued;
                  const isLast = index === filteredCommands.length - 1;
                  return (
                    <View
                      key={cmd.id}
                      style={[
                        styles.commandHistoryRow,
                        !isLast && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name={
                          iconMeta.name as React.ComponentProps<
                            typeof Feather
                          >["name"]
                        }
                        size={16}
                        color={iconMeta.color}
                      />
                      <View style={styles.commandHistoryInfo}>
                        <Text
                          style={[
                            styles.commandHistoryType,
                            { color: colors.foreground },
                          ]}
                        >
                          {t(`assetDetail.cmdType_${cmd.commandType}`, {
                            defaultValue: cmd.commandType.replace(/_/g, " "),
                          })}
                        </Text>
                        {cmd.errorMessage ? (
                          <Text
                            style={[
                              styles.commandHistoryError,
                              { color: "#EF4444" },
                            ]}
                            numberOfLines={1}
                          >
                            {cmd.errorMessage}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.commandHistoryRight}>
                        <Text
                          style={[
                            styles.commandHistoryStatus,
                            { color: iconMeta.color },
                          ]}
                        >
                          {t(`assetDetail.cmdStatus_${cmd.status}`, {
                            defaultValue: cmd.status,
                          })}
                        </Text>
                        <Text
                          style={[
                            styles.commandHistoryTime,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {formatRelativeTime(cmd.queuedAt, t)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
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
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  assetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerOnlineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  assetTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  assetSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  detailCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
  },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  actionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 4,
  },
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
  refreshingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  refreshingText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  commandsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  commandBtn: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  commandText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  lastUpdate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
  noDeviceHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginVertical: 4,
  },
  commandHistoryCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  commandHistoryEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20,
  },
  commandHistoryEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  commandHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  commandHistoryInfo: { flex: 1 },
  commandHistoryType: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  commandHistoryError: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  commandHistoryRight: { alignItems: "flex-end", gap: 2 },
  commandHistoryStatus: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  commandHistoryTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  telemetrySkeleton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  commandFilterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 2 },
  commandFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  commandFilterChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  telemetryStatsCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statsLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  statsValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  batteryValueRow: { flexDirection: "row", alignItems: "center" },
  skeletonPill: { width: 72, height: 14, borderRadius: 7 },
  statsEmpty: { paddingVertical: 14, alignItems: "center" },
  onlineStateBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
});
