import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface RentalDetail {
  id: string;
  status: string;
  startAt: string | null;
  plannedEndAt: string | null;
  actualEndAt: string | null;
  depositAmount: string | null;
  notes: string | null;
  createdAt: string;
  durationMinutes: number;
  asset: {
    id: string;
    assetType: string;
    brand: string;
    model: string;
    internalCode: string;
  } | null;
  telemetry: {
    lat: number | null;
    lng: number | null;
    speed: number | null;
    batteryPercent: number | null;
    lockState: string | null;
    odometer: number | null;
    recordedAt: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#E8F5E9", text: "#2E7D32" },
  overdue: { bg: "#FFF3E0", text: "#E65100" },
  completed: { bg: "#E3F2FD", text: "#1565C0" },
  canceled: { bg: "#FAFAFA", text: "#757575" },
};

const ASSET_TYPE_ICONS: Record<string, string> = {
  bike: "activity",
  ebike: "zap",
  scooter: "wind",
  escooter: "battery-charging",
};

export default function RentalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const _colors = useColors();
  const router = useRouter();

  const [rental, setRental] = useState<RentalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/rentals/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) setRental(json.data);
    } catch (err) {
      console.error("Failed to fetch rental detail:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchDetail();
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [id, fetchDetail]);

  const handleReturnPress = async () => {
    if (!confirming) {
      setConfirming(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirming(false);
    setReturning(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/rentals/${id}/return`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchDetail();
      }
    } catch {
    } finally {
      setReturning(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} ${t("rentalDetail.min")}`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h < 24)
      return `${h}${t("rentalDetail.h")} ${m}${t("rentalDetail.min")}`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}${t("rentalDetail.d")} ${rh}${t("rentalDetail.h")}`;
  };

  const formatDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  if (!rental) {
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={48} color="#ccc" />
        <Text style={styles.emptyText}>{t("rentalDetail.notFound")}</Text>
      </View>
    );
  }

  const statusStyle = STATUS_COLORS[rental.status] || STATUS_COLORS.canceled;
  const isActive = rental.status === "active" || rental.status === "overdue";
  const asset = rental.asset;
  const tel = rental.telemetry;
  const typeIcon = asset
    ? ASSET_TYPE_ICONS[asset.assetType] || "circle"
    : "circle";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View
            style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
          >
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {t(`clientRentals.status_${rental.status}`, rental.status)}
            </Text>
          </View>
          <Text style={styles.durationText}>
            {formatDuration(rental.durationMinutes)}
          </Text>
        </View>

        {asset && (
          <View style={styles.assetInfo}>
            <View style={styles.assetIconWrap}>
              <Feather
                name={typeIcon as React.ComponentProps<typeof Feather>["name"]}
                size={24}
                color="#F5C518"
              />
            </View>
            <View style={styles.assetTextWrap}>
              <Text style={styles.assetName}>
                {asset.brand} {asset.model}
              </Text>
              <Text style={styles.assetCode}>
                {asset.internalCode} · {asset.assetType.toUpperCase()}
              </Text>
            </View>
            {isActive && (
              <TouchableOpacity
                style={styles.viewVehicleBtn}
                onPress={() =>
                  router.push({
                    pathname: "/(client-tabs)/vehicle-detail",
                    params: { id: asset.id },
                  })
                }
                activeOpacity={0.7}
              >
                <Feather name="map" size={16} color="#F5C518" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.sectionTitle}>{t("rentalDetail.timeline")}</Text>
        <View style={styles.timelineRow}>
          <Feather name="play-circle" size={16} color="#4CAF50" />
          <Text style={styles.timelineLabel}>{t("clientRentals.started")}</Text>
          <Text style={styles.timelineValue}>{formatDate(rental.startAt)}</Text>
        </View>
        {rental.plannedEndAt && (
          <View style={styles.timelineRow}>
            <Feather name="clock" size={16} color="#FF9800" />
            <Text style={styles.timelineLabel}>
              {t("rentalDetail.plannedEnd")}
            </Text>
            <Text style={styles.timelineValue}>
              {formatDate(rental.plannedEndAt)}
            </Text>
          </View>
        )}
        {rental.actualEndAt && (
          <View style={styles.timelineRow}>
            <Feather name="check-circle" size={16} color="#2196F3" />
            <Text style={styles.timelineLabel}>{t("clientRentals.ended")}</Text>
            <Text style={styles.timelineValue}>
              {formatDate(rental.actualEndAt)}
            </Text>
          </View>
        )}
      </View>

      {tel && (
        <View style={styles.telemetryCard}>
          <Text style={styles.sectionTitle}>
            {t("rentalDetail.vehicleStatus")}
          </Text>
          <View style={styles.telGrid}>
            <View style={styles.telItem}>
              <Feather
                name="battery"
                size={16}
                color={
                  tel.batteryPercent != null
                    ? tel.batteryPercent > 50
                      ? "#4CAF50"
                      : tel.batteryPercent > 20
                        ? "#FF9800"
                        : "#E53935"
                    : "#999"
                }
              />
              <Text style={styles.telValue}>{tel.batteryPercent ?? "—"}%</Text>
              <Text style={styles.telLabel}>{t("vehicleDetail.battery")}</Text>
            </View>
            <View style={styles.telItem}>
              <Feather name="navigation" size={16} color="#2196F3" />
              <Text style={styles.telValue}>
                {tel.speed != null ? Math.round(tel.speed) : "—"}
              </Text>
              <Text style={styles.telLabel}>{t("vehicleDetail.speedKmh")}</Text>
            </View>
            <View style={styles.telItem}>
              <Feather
                name={tel.lockState === "locked" ? "lock" : "unlock"}
                size={16}
                color={tel.lockState === "locked" ? "#4CAF50" : "#E53935"}
              />
              <Text style={styles.telValue}>
                {tel.lockState === "locked" ? "🔒" : "🔓"}
              </Text>
              <Text style={styles.telLabel}>{t("rentalDetail.lockState")}</Text>
            </View>
            {tel.odometer != null && (
              <View style={styles.telItem}>
                <Feather name="trending-up" size={16} color="#9C27B0" />
                <Text style={styles.telValue}>{Math.round(tel.odometer)}</Text>
                <Text style={styles.telLabel}>
                  {t("vehicleDetail.odometerKm")}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {rental.depositAmount && Number(rental.depositAmount) > 0 && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("rentalDetail.deposit")}</Text>
            <Text style={styles.infoValue}>{rental.depositAmount} ₽</Text>
          </View>
        </View>
      )}

      {rental.notes && (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t("rentalDetail.notes")}</Text>
          <Text style={styles.notesText}>{rental.notes}</Text>
        </View>
      )}

      {isActive && (
        <TouchableOpacity
          style={[
            styles.returnBtn,
            confirming && styles.returnBtnConfirm,
            returning && { opacity: 0.7 },
          ]}
          onPress={handleReturnPress}
          disabled={returning}
          activeOpacity={0.7}
        >
          {returning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : confirming ? (
            <>
              <Feather name="check" size={18} color="#1a1a1a" />
              <Text style={[styles.returnBtnText, { color: "#1a1a1a" }]}>
                {t("clientRentals.confirmReturn")}
              </Text>
            </>
          ) : (
            <>
              <Feather name="corner-down-left" size={18} color="#fff" />
              <Text style={styles.returnBtnText}>
                {t("clientRentals.returnVehicle")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scroll: { padding: 16, paddingBottom: 120, gap: 12 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  emptyText: { fontSize: 15, color: "#8c8c8c", marginTop: 12 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  durationText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  assetInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  assetIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F5C51818",
    justifyContent: "center",
    alignItems: "center",
  },
  assetTextWrap: { flex: 1 },
  assetName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#1a1a1a",
  },
  assetCode: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#8c8c8c",
    marginTop: 1,
  },
  viewVehicleBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F5C51818",
    justifyContent: "center",
    alignItems: "center",
  },
  timelineCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#8c8c8c",
    marginBottom: 4,
  },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timelineLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#555",
  },
  timelineValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#1a1a1a",
  },
  telemetryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  telGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  telItem: {
    width: "47%",
    alignItems: "center",
    gap: 4,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
  },
  telValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  telLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#8c8c8c" },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#555" },
  infoValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#555" },
  returnBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E53935",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  returnBtnConfirm: {
    backgroundColor: "#F5C518",
  },
  returnBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
