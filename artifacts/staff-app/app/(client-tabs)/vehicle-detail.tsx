import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface VehicleDetail {
  id: string;
  assetType: string;
  brand: string;
  model: string;
  internalCode: string;
  status: string;
  telemetry: {
    lat: number | null;
    lng: number | null;
    speed: number | null;
    batteryPercent: number | null;
    batteryVoltage: number | null;
    lockState: string | null;
    alarmState: string | null;
    onlineState: string | null;
    odometer: number | null;
    recordedAt: string | null;
  } | null;
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commanding, setCommanding] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/vehicles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) setVehicle(json.data);
    } catch (err) {
      console.error("Failed to fetch vehicle detail:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id, fetchDetail]);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(fetchDetail, 15000);
    return () => clearInterval(interval);
  }, [id, fetchDetail]);

  const sendCommand = async (command: string, label: string) => {
    setCommanding(command);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/vehicles/${id}/${command}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        Alert.alert(t("vehicleDetail.commandSent"), `${label} — ${t("vehicleDetail.queued")}`);
        setTimeout(fetchDetail, 3000);
      } else {
        Alert.alert(t("common.error"), json.error?.message || "Failed");
      }
    } catch {
      Alert.alert(t("common.error"), t("vehicleDetail.commandFailed"));
    } finally {
      setCommanding(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={48} color="#ccc" />
        <Text style={styles.emptyText}>{t("vehicleDetail.notFound")}</Text>
      </View>
    );
  }

  const tel = vehicle.telemetry;
  const isLocked = tel?.lockState === "locked";
  const isArmed = tel?.alarmState === "armed";
  const isOnline = tel?.onlineState === "online";
  const batteryColor = tel?.batteryPercent != null
    ? tel.batteryPercent > 50 ? "#4CAF50" : tel.batteryPercent > 20 ? "#FF9800" : "#E53935"
    : "#999";

  const mapHtml = tel?.lat && tel?.lng ? `
    <!DOCTYPE html>
    <html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
    </head><body>
    <div id="map"></div>
    <script>
      var map = L.map('map').setView([${tel.lat},${tel.lng}],16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
      L.circleMarker([${tel.lat},${tel.lng}],{radius:10,color:'#F5C518',fillColor:'#F5C518',fillOpacity:0.8,weight:3}).addTo(map)
        .bindPopup('${vehicle.internalCode}').openPopup();
    </script>
    </body></html>
  ` : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDetail(); }} tintColor="#F5C518" />
      }
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.vehicleName}>{vehicle.brand} {vehicle.model}</Text>
            <Text style={styles.vehicleCode}>{vehicle.internalCode} · {vehicle.assetType.toUpperCase()}</Text>
          </View>
          <View style={[styles.onlineBadge, { backgroundColor: isOnline ? "#E8F5E9" : "#FFF3E0" }]}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? "#4CAF50" : "#FF9800" }]} />
            <Text style={[styles.onlineText, { color: isOnline ? "#2E7D32" : "#E65100" }]}>
              {isOnline ? t("vehicleDetail.online") : t("vehicleDetail.offline")}
            </Text>
          </View>
        </View>
      </View>

      {mapHtml && (
        <View style={styles.mapContainer}>
          {Platform.OS === "web" ? (
            <iframe
              srcDoc={mapHtml}
              style={{ width: "100%", height: "100%", border: "none", borderRadius: 16 } as any}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Feather name="map" size={32} color="#999" />
              <Text style={styles.mapCoords}>
                {tel?.lat?.toFixed(5)}, {tel?.lng?.toFixed(5)}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Feather name="battery" size={20} color={batteryColor} />
          <Text style={styles.statValue}>{tel?.batteryPercent ?? "—"}%</Text>
          <Text style={styles.statLabel}>{t("vehicleDetail.battery")}</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="navigation" size={20} color="#2196F3" />
          <Text style={styles.statValue}>{tel?.speed != null ? `${Math.round(tel.speed)}` : "—"}</Text>
          <Text style={styles.statLabel}>{t("vehicleDetail.speedKmh")}</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="trending-up" size={20} color="#9C27B0" />
          <Text style={styles.statValue}>{tel?.odometer != null ? `${Math.round(tel.odometer)}` : "—"}</Text>
          <Text style={styles.statLabel}>{t("vehicleDetail.odometerKm")}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusItem, { backgroundColor: isLocked ? "#E8F5E9" : "#FFEBEE" }]}>
          <Feather name={isLocked ? "lock" : "unlock"} size={18} color={isLocked ? "#2E7D32" : "#C62828"} />
          <Text style={[styles.statusText, { color: isLocked ? "#2E7D32" : "#C62828" }]}>
            {isLocked ? t("vehicleDetail.locked") : t("vehicleDetail.unlocked")}
          </Text>
        </View>
        <View style={[styles.statusItem, { backgroundColor: isArmed ? "#E8F5E9" : "#FFF3E0" }]}>
          <Feather name={isArmed ? "shield" : "shield-off"} size={18} color={isArmed ? "#2E7D32" : "#E65100"} />
          <Text style={[styles.statusText, { color: isArmed ? "#2E7D32" : "#E65100" }]}>
            {isArmed ? t("vehicleDetail.armed") : t("vehicleDetail.disarmed")}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t("vehicleDetail.controls")}</Text>
      <View style={styles.controlsGrid}>
        <TouchableOpacity
          style={[styles.controlBtn, isLocked ? styles.controlBtnDanger : styles.controlBtnPrimary]}
          onPress={() => sendCommand(isLocked ? "unlock" : "lock", isLocked ? t("vehicleDetail.unlock") : t("vehicleDetail.lock"))}
          disabled={!!commanding}
          activeOpacity={0.7}
        >
          {commanding === "lock" || commanding === "unlock" ? (
            <ActivityIndicator color={isLocked ? "#C62828" : "#1a1a1a"} size="small" />
          ) : (
            <>
              <Feather name={isLocked ? "unlock" : "lock"} size={20} color={isLocked ? "#C62828" : "#1a1a1a"} />
              <Text style={[styles.controlBtnText, isLocked ? styles.controlTextDanger : styles.controlTextPrimary]}>
                {isLocked ? t("vehicleDetail.unlock") : t("vehicleDetail.lock")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isArmed ? styles.controlBtnWarning : styles.controlBtnSuccess]}
          onPress={() => sendCommand(isArmed ? "disarm" : "arm", isArmed ? t("vehicleDetail.disarmAlarm") : t("vehicleDetail.armAlarm"))}
          disabled={!!commanding}
          activeOpacity={0.7}
        >
          {commanding === "arm" || commanding === "disarm" ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <>
              <Feather name={isArmed ? "shield-off" : "shield"} size={20} color="#1a1a1a" />
              <Text style={[styles.controlBtnText, styles.controlTextPrimary]}>
                {isArmed ? t("vehicleDetail.disarmAlarm") : t("vehicleDetail.armAlarm")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {tel?.recordedAt && (
        <Text style={styles.lastUpdate}>
          {t("vehicleDetail.lastUpdate")}: {new Date(tel.recordedAt).toLocaleString()}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scroll: { padding: 16, paddingBottom: 120, gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  emptyText: { fontSize: 15, color: "#8c8c8c", marginTop: 12 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  vehicleName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  vehicleCode: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8c8c8c", marginTop: 2 },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e0e0e0",
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8e8e8",
  },
  mapCoords: { fontSize: 12, color: "#666", fontFamily: "Inter_400Regular" },
  statsGrid: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#8c8c8c" },
  statusRow: { flexDirection: "row", gap: 8 },
  statusItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  statusText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#8c8c8c",
    marginTop: 4,
    marginLeft: 4,
  },
  controlsGrid: { flexDirection: "row", gap: 8 },
  controlBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  controlBtnPrimary: { backgroundColor: "#F5C518" },
  controlBtnDanger: { backgroundColor: "#FFEBEE" },
  controlBtnSuccess: { backgroundColor: "#E8F5E9" },
  controlBtnWarning: { backgroundColor: "#FFF3E0" },
  controlBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  controlTextPrimary: { color: "#1a1a1a" },
  controlTextDanger: { color: "#C62828" },
  lastUpdate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#aaa",
    textAlign: "center",
    marginTop: 4,
  },
});
