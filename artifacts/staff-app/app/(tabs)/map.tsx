import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { getAccessToken, getCompanyId } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const FAST_POLL_MS = 5000;
const SLOW_POLL_MS = 30000;

interface FleetMapItem {
  id: string;
  internalCode: string;
  assetType: string;
  status: string;
  brand: string;
  model: string;
  lat: number | null;
  lng: number | null;
  batteryPercent: number | null;
  speed: number | null;
  lockState: string | null;
  lastSeen: string | null;
}

async function fetchFleetMap(): Promise<FleetMapItem[]> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return [];

  const res = await fetch(`${BASE_URL}/api/fleet-map`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return [];
  const { data } = await res.json();
  return Array.isArray(data) ? data : [];
}

const STATUS_COLORS: Record<string, string> = {
  available: "#43A047",
  rented: "#1E88E5",
  maintenance: "#FF9800",
  blocked: "#E53935",
  charging: "#8b5cf6",
  reserved: "#06b6d4",
  lost: "#6b7280",
  stolen: "#dc2626",
  draft: "#8c8c8c",
  retired: "#8c8c8c",
};

function getBatteryColor(pct: number): string {
  if (pct <= 20) return "#EF4444";
  if (pct <= 40) return "#F97316";
  if (pct <= 70) return "#EAB308";
  return "#22C55E";
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function MapScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const queryClient = useQueryClient();

  const [fastPollUntil, setFastPollUntil] = useState<number>(() => {
    const cached = queryClient.getQueryData<number>(["fleet-fast-poll-until"]);
    return cached && cached > Date.now() ? cached : 0;
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const cached = queryClient.getQueryData<number>(["fleet-fast-poll-until"]);
    if (cached && cached > Date.now()) {
      setFastPollUntil(cached);
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        Array.isArray(event.query.queryKey) &&
        event.query.queryKey[0] === "fleet-fast-poll-until"
      ) {
        const until = queryClient.getQueryData<number>(["fleet-fast-poll-until"]);
        if (until && until > Date.now()) {
          setFastPollUntil(until);
        }
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const isFastPolling = Date.now() < fastPollUntil;

  const { data: items = [], isLoading, isFetching } = useQuery({
    queryKey: ["staff-fleet-map"],
    queryFn: fetchFleetMap,
    refetchInterval: isFastPolling ? FAST_POLL_MS : SLOW_POLL_MS,
  });

  useEffect(() => {
    if (!isFetching) {
      setLastUpdated(new Date());
    }
  }, [isFetching]);

  useEffect(() => {
    if (!isFastPolling) return;
    const remaining = fastPollUntil - Date.now();
    const timer = setTimeout(() => setFastPollUntil(0), remaining);
    return () => clearTimeout(timer);
  }, [fastPollUntil, isFastPolling]);

  const withCoords = items.filter((i) => i.lat != null && i.lng != null);
  const withoutCoords = items.filter((i) => i.lat == null || i.lng == null);

  const statusCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {t("fleetMap.title")}
            </Text>
            {lastUpdated && (
              <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                {t("fleetMap.updated", { time: lastUpdated.toLocaleTimeString() })}
              </Text>
            )}
          </View>
          {isFastPolling && (
            <View style={[styles.fastPollBadge, { backgroundColor: colors.primary + "20" }]}>
              <View style={[styles.fastPollDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.fastPollText, { color: colors.primary }]}>
                {t("fleetMap.fastPoll")}
              </Text>
            </View>
          )}
          {isFetching && !isLoading && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("fleetMap.total")}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: "#22C55E" }]}>{withCoords.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("fleetMap.located")}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.mutedForeground }]}>
              {withoutCoords.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("fleetMap.noGps")}
            </Text>
          </View>
        </View>

        {Object.entries(statusCounts).length > 0 && (
          <View style={[styles.legendCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("fleetMap.statusBreakdown")}
            </Text>
            {Object.entries(statusCounts).map(([status, count]) => (
              <View key={status} style={styles.legendRow}>
                <View
                  style={[styles.legendDot, { backgroundColor: STATUS_COLORS[status] ?? "#8c8c8c" }]}
                />
                <Text style={[styles.legendLabel, { color: colors.foreground }]}>
                  {t(`assets.status_${status}`, { defaultValue: status })}
                </Text>
                <Text style={[styles.legendCount, { color: colors.mutedForeground }]}>{count}</Text>
              </View>
            ))}
          </View>
        )}

        {withCoords.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("fleetMap.locatedVehicles")}
            </Text>
            {withCoords.map((item) => (
              <View
                key={item.id}
                style={[styles.vehicleCard, { backgroundColor: colors.card }]}
              >
                <View style={styles.vehicleRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[item.status] ?? "#8c8c8c" },
                    ]}
                  />
                  <View style={styles.vehicleInfo}>
                    <Text style={[styles.vehicleCode, { color: colors.foreground }]}>
                      {item.internalCode}
                    </Text>
                    <Text style={[styles.vehicleSub, { color: colors.mutedForeground }]}>
                      {item.brand} {item.model} · {t(`assets.status_${item.status}`, { defaultValue: item.status })}
                    </Text>
                  </View>
                  <View style={styles.vehicleMeta}>
                    {item.batteryPercent != null && (
                      <Text
                        style={[
                          styles.batteryText,
                          { color: getBatteryColor(item.batteryPercent) },
                        ]}
                      >
                        {item.batteryPercent}%
                      </Text>
                    )}
                    {item.lockState && (
                      <Feather
                        name={item.lockState === "locked" ? "lock" : "unlock"}
                        size={14}
                        color={item.lockState === "locked" ? "#EF4444" : "#22C55E"}
                      />
                    )}
                  </View>
                </View>
                <Text style={[styles.coordsText, { color: colors.mutedForeground }]}>
                  {item.lat!.toFixed(5)}, {item.lng!.toFixed(5)}
                  {item.lastSeen ? ` · ${formatLastSeen(item.lastSeen)}` : ""}
                </Text>
              </View>
            ))}
          </>
        )}

        {withoutCoords.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("fleetMap.noGpsVehicles")}
            </Text>
            {withoutCoords.map((item) => (
              <View
                key={item.id}
                style={[styles.vehicleCard, { backgroundColor: colors.card, opacity: 0.6 }]}
              >
                <View style={styles.vehicleRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[item.status] ?? "#8c8c8c" },
                    ]}
                  />
                  <View style={styles.vehicleInfo}>
                    <Text style={[styles.vehicleCode, { color: colors.foreground }]}>
                      {item.internalCode}
                    </Text>
                    <Text style={[styles.vehicleSub, { color: colors.mutedForeground }]}>
                      {item.brand} {item.model} · {t(`assets.status_${item.status}`, { defaultValue: item.status })}
                    </Text>
                  </View>
                  {item.batteryPercent != null && (
                    <Text
                      style={[
                        styles.batteryText,
                        { color: getBatteryColor(item.batteryPercent) },
                      ]}
                    >
                      {item.batteryPercent}%
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {items.length === 0 && (
          <View style={styles.empty}>
            <Feather name="map" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {t("fleetMap.noVehicles")}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {t("fleetMap.noVehiclesHint")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, paddingBottom: 100 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  fastPollBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  fastPollDot: { width: 6, height: 6, borderRadius: 3 },
  fastPollText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2, textAlign: "center" },
  legendCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  legendCount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },
  vehicleCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  vehicleInfo: { flex: 1 },
  vehicleCode: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  vehicleSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  vehicleMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  batteryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  coordsText: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 20 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
