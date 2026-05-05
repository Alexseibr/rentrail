import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { getAccessToken, getCompanyId } from "@/services/api";
import { MediaAttachments } from "@/components/MediaAttachments";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function fetchRental(id: string) {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return null;

  const res = await fetch(`${BASE_URL}/api/rentals/${id}`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

interface TelemetrySnapshot {
  lockState: string | null;
  onlineState: string | null;
  batteryPercent: number | null;
  recordedAt: string | null;
  lat: number | null;
  lng: number | null;
}

async function fetchTelemetry(assetId: string): Promise<TelemetrySnapshot | null> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return null;

  const res = await fetch(`${BASE_URL}/api/telemetry/assets/${assetId}/latest`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

type VehicleCommand = "lock" | "unlock";

const COMMAND_ENDPOINTS: Record<VehicleCommand, string> = {
  lock: "lock",
  unlock: "unlock",
};

export default function RentalDetailScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [returnNotes, setReturnNotes] = useState("");
  const [showReturn, setShowReturn] = useState(false);
  const [refreshingTelemetry, setRefreshingTelemetry] = useState(false);
  const [commanding, setCommanding] = useState<VehicleCommand | null>(null);
  const prevTelemetryFetching = useRef(false);

  const { data: rental, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: () => fetchRental(id!),
    enabled: !!id,
  });

  const assetId: string | undefined = rental?.assetId;

  const {
    isFetching: telemetryFetching,
    data: telemetry,
    isLoading: isTelemetryLoading,
    isSuccess: isTelemetrySuccess,
  } = useQuery({
    queryKey: ["rental-telemetry", assetId],
    queryFn: () => fetchTelemetry(assetId!),
    enabled: !!assetId,
    refetchInterval: ["active", "overdue", "extended"].includes(rental?.status) ? 15000 : false,
  });

  useEffect(() => {
    if (prevTelemetryFetching.current && !telemetryFetching && refreshingTelemetry) {
      setRefreshingTelemetry(false);
    }
    prevTelemetryFetching.current = telemetryFetching;
  }, [telemetryFetching, refreshingTelemetry]);

  const handleVehicleCommand = (command: VehicleCommand) => {
    if (!assetId) return;
    if (!canReturn) return;
    const label = command === "lock" ? t("rentalDetail.commandLock") : t("rentalDetail.commandUnlock");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("rentalDetail.confirmCommandTitle"),
      t("rentalDetail.confirmCommand", { command: label }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          onPress: async () => {
            setCommanding(command);
            try {
              const token = await getAccessToken();
              const companyId = await getCompanyId();
              const res = await fetch(
                `${BASE_URL}/api/assets/${assetId}/${COMMAND_ENDPOINTS[command]}`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token ?? ""}`,
                    "x-company-id": companyId ?? "",
                  },
                },
              );
              if (res.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setRefreshingTelemetry(true);
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ["rental-telemetry", assetId] });
                }, 3000);
              } else {
                const json = await res.json().catch(() => ({}));
                Alert.alert(t("common.error"), json?.error?.message ?? t("rentalDetail.commandFailed"));
              }
            } catch {
              Alert.alert(t("common.error"), t("rentalDetail.commandFailed"));
            } finally {
              setCommanding(null);
            }
          },
        },
      ],
    );
  };

  const returnMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const companyId = await getCompanyId();
      if (!token || !companyId) throw new Error(t("scanner.notAuthenticated"));

      const res = await fetch(`${BASE_URL}/api/rentals/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({ status: "completed", notes: returnNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("rentalDetail.failedReturn"));
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      if (assetId) {
        setRefreshingTelemetry(true);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["rental-telemetry", assetId] });
        }, 3000);
      }
      setShowReturn(false);
      Alert.alert(t("rentalDetail.success"), t("rentalDetail.returnCompleted"));
    },
    onError: (err: Error) => {
      Alert.alert(t("common.error"), err.message);
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!rental) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("rentalDetail.notFound")}</Text>
      </View>
    );
  }

  const fields = [
    { label: t("rentalDetail.status"), value: rental.status },
    { label: t("rentalDetail.type"), value: rental.rentalType },
    { label: t("rentalDetail.created"), value: new Date(rental.createdAt).toLocaleDateString() },
  ].filter((f) => f.value);

  const canReturn = ["active", "overdue", "extended"].includes(rental.status);

  const lockStateKnown = telemetry != null && telemetry.lockState != null;
  const onlineStateKnown = telemetry != null && telemetry.onlineState != null;
  const isLocked = telemetry?.lockState === "locked";
  const isOnline = telemetry?.onlineState === "online";
  const hasTelemetryBadges = lockStateKnown || onlineStateKnown;

  const hasLocation = telemetry != null && telemetry.lat != null && telemetry.lng != null;

  const handleOpenLocation = () => {
    if (!hasLocation) return;
    const lat = telemetry!.lat!;
    const lng = telemetry!.lng!;
    const coordsLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const mapsUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
    Alert.alert(
      t("rentalDetail.openMapTitle"),
      `${coordsLabel}\n\n${t("rentalDetail.openMapMessage")}`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("rentalDetail.copyCoords"),
          onPress: () => {
            Share.share({ message: coordsLabel }).catch(() => {});
          },
        },
        {
          text: t("rentalDetail.openMapConfirm"),
          onPress: () => {
            Linking.canOpenURL(mapsUrl)
              .then((supported) => {
                if (supported) return Linking.openURL(mapsUrl);
                Alert.alert(t("common.error"), t("rentalDetail.noLocation"));
              })
              .catch(() => {
                Alert.alert(t("common.error"), t("rentalDetail.noLocation"));
              });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.statusBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.statusText, { color: colors.primary }]}>
              {rental.status.replace(/_/g, " ")}
            </Text>
          </View>
          <Text style={[styles.rentalTitle, { color: colors.foreground }]}>
            {rental.rentalType} {t("rentalDetail.rental")}
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

        {assetId && (
          <View style={[styles.vehicleStatusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.vehicleStatusTitle, { color: colors.mutedForeground }]}>
              {t("rentalDetail.vehicleStatus")}
            </Text>

            {isTelemetryLoading && (
              <ActivityIndicator size="small" color={colors.mutedForeground} style={styles.telemetrySpinner} />
            )}

            {!isTelemetryLoading && isTelemetrySuccess && !telemetry && (
              <Text style={[styles.noDeviceText, { color: colors.mutedForeground }]}>
                {t("rentalDetail.noDeviceData")}
              </Text>
            )}

            {refreshingTelemetry && (
              <View style={styles.refreshingRow}>
                <ActivityIndicator size="small" color={colors.mutedForeground} />
                <Text style={[styles.refreshingText, { color: colors.mutedForeground }]}>
                  {t("rentalDetail.refreshing")}
                </Text>
              </View>
            )}

            {hasTelemetryBadges && (
              <View style={[styles.badgesRow, refreshingTelemetry && styles.badgesRowFading]}>
                {lockStateKnown && (
                  <View style={[styles.badge, { backgroundColor: isLocked ? "#E8F5E9" : "#FFEBEE" }]}>
                    <Feather
                      name={isLocked ? "lock" : "unlock"}
                      size={13}
                      color={isLocked ? "#2E7D32" : "#C62828"}
                    />
                    <Text style={[styles.badgeText, { color: isLocked ? "#2E7D32" : "#C62828" }]}>
                      {isLocked ? t("rentalDetail.locked") : t("rentalDetail.unlocked")}
                    </Text>
                  </View>
                )}
                {onlineStateKnown && (
                  <View style={[styles.badge, { backgroundColor: isOnline ? "#E3F2FD" : "#F5F5F5" }]}>
                    <Feather
                      name={isOnline ? "wifi" : "wifi-off"}
                      size={13}
                      color={isOnline ? "#1565C0" : "#757575"}
                    />
                    <Text style={[styles.badgeText, { color: isOnline ? "#1565C0" : "#757575" }]}>
                      {isOnline ? t("rentalDetail.online") : t("rentalDetail.offline")}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {hasLocation && (
              <TouchableOpacity
                style={[styles.locationRow, { borderColor: colors.border }]}
                onPress={handleOpenLocation}
                activeOpacity={0.7}
              >
                <Feather name="map-pin" size={14} color={colors.primary} />
                <View style={styles.locationBody}>
                  <Text style={[styles.locationLabel, { color: colors.mutedForeground }]}>
                    {t("rentalDetail.location")}
                  </Text>
                  <Text style={[styles.locationText, { color: colors.foreground }]}>
                    {telemetry!.lat!.toFixed(5)}, {telemetry!.lng!.toFixed(5)}
                  </Text>
                </View>
                <Feather name="external-link" size={13} color={colors.mutedForeground} style={styles.locationChevron} />
              </TouchableOpacity>
            )}

            {!isTelemetryLoading && !!telemetry && lockStateKnown && canReturn && (
              <View style={styles.commandsRow}>
                <TouchableOpacity
                  style={[
                    styles.commandBtn,
                    { backgroundColor: isLocked ? "#FFEBEE" : colors.secondary, borderColor: colors.border },
                  ]}
                  onPress={() => handleVehicleCommand(isLocked ? "unlock" : "lock")}
                  disabled={!!commanding}
                  activeOpacity={0.7}
                >
                  {commanding === "lock" || commanding === "unlock" ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather
                      name={isLocked ? "unlock" : "lock"}
                      size={15}
                      color={isLocked ? "#C62828" : colors.primary}
                    />
                  )}
                  <Text style={[styles.commandBtnText, { color: isLocked ? "#C62828" : colors.primary }]}>
                    {isLocked ? t("rentalDetail.commandUnlock") : t("rentalDetail.commandLock")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {canReturn && (
          <View style={styles.returnSection}>
            {!showReturn ? (
              <TouchableOpacity
                style={[styles.returnBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowReturn(true)}
                activeOpacity={0.8}
              >
                <Feather name="log-in" size={18} color="#fff" />
                <Text style={styles.returnBtnText}>{t("rentalDetail.processReturn")}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.returnForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.returnTitle, { color: colors.foreground }]}>{t("rentalDetail.returnVehicle")}</Text>

                <MediaAttachments entityType="rental" entityId={id!} />

                <TextInput
                  style={[styles.notesInput, { borderColor: colors.border, color: colors.foreground }]}
                  placeholder={t("rentalDetail.returnNotes")}
                  placeholderTextColor={colors.mutedForeground}
                  value={returnNotes}
                  onChangeText={setReturnNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <View style={styles.returnActions}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.border }]}
                    onPress={() => setShowReturn(false)}
                  >
                    <Text style={[styles.cancelText, { color: colors.foreground }]}>{t("rentalDetail.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                    onPress={() => returnMutation.mutate()}
                    disabled={returnMutation.isPending}
                  >
                    {returnMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.confirmText}>{t("rentalDetail.completeReturn")}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
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
  rentalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textTransform: "capitalize" as const },
  detailCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  vehicleStatusCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  vehicleStatusTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  telemetrySpinner: { alignSelf: "flex-start" },
  noDeviceText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  refreshingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  refreshingText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgesRowFading: { opacity: 0.4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  locationBody: { flex: 1, gap: 1 },
  locationLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase" as const, letterSpacing: 0.3 },
  locationText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  locationChevron: { marginLeft: 2 },
  commandsRow: { flexDirection: "row", gap: 8 },
  commandBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  commandBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  returnSection: {},
  returnBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  returnBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  returnForm: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 16 },
  returnTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  notesInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80 },
  returnActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
