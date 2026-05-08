import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useAppStateFocus } from "@/hooks/useAppStateFocus";
import { getAccessToken, getCompanyId } from "@/services/api";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessTab } from "@/utils/permissions";
import { readManyCoordsFromCache } from "@/services/coordsCache";
import { CachedCoordinates } from "@/hooks/useCachedCoordinates";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Asset {
  id: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  internalCode: string | null;
  status: string;
  qrCode: string | null;
  batteryPercent: number | null;
  onlineState: string | null;
}

function getBatteryColor(pct: number): string {
  if (pct <= 20) return "#EF4444";
  if (pct <= 40) return "#F97316";
  if (pct <= 70) return "#EAB308";
  return "#22C55E";
}

function BatteryIcon({
  percent,
  size = 16,
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

async function fetchAssets(): Promise<Asset[]> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return [];

  const res = await fetch(`${BASE_URL}/api/assets`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return [];
  const { data } = await res.json();
  return data;
}

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

const STATUS_COLORS: Record<string, string> = {
  available: "#43A047",
  rented: "#1E88E5",
  maintenance: "#FF9800",
  blocked: "#E53935",
  draft: "#8c8c8c",
  retired: "#8c8c8c",
};

const TYPE_ICONS: Record<string, string> = {
  bike: "circle",
  ebike: "zap",
  scooter: "wind",
  escooter: "activity",
};

const STATUS_FILTER_KEYS = [
  "available",
  "rented",
  "maintenance",
  "blocked",
] as const;

function openMaps(lat: number, lng: number) {
  const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
  const webUrl = `https://maps.google.com/?q=${lat},${lng}`;
  Linking.canOpenURL(geoUrl)
    .then((ok) => Linking.openURL(ok ? geoUrl : webUrl))
    .catch(() => Linking.openURL(webUrl).catch(() => {}));
}

export default function AssetsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { user, companyId } = useAuth();
  const memberships = user?.memberships || user?.companies;
  const roleCode =
    memberships?.find((c: { companyId: string }) => c.companyId === companyId)
      ?.roleCode || memberships?.[0]?.roleCode;
  const canSeeMap = canAccessTab(roleCode, "assets");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [onlineFilter, setOnlineFilter] = useState<string | null>(null);
  const [coordsMap, setCoordsMap] = useState<Record<string, CachedCoordinates>>(
    {},
  );

  const {
    data: assets = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["assets"],
    queryFn: fetchAssets,
    staleTime: 30000,
  });

  const assetsRef = React.useRef(assets);
  assetsRef.current = assets;

  useAppStateFocus(() => {
    refetch();
    const ids = assetsRef.current.map((a) => a.id);
    if (ids.length > 0) {
      readManyCoordsFromCache(ids).then(setCoordsMap);
    }
  });

  useEffect(() => {
    if (assets.length === 0) return;
    readManyCoordsFromCache(assets.map((a) => a.id)).then(setCoordsMap);
  }, [assets]);

  const filtered = assets.filter((a) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (a.brand ?? "").toLowerCase().includes(q) ||
      (a.model ?? "").toLowerCase().includes(q) ||
      (a.internalCode ?? "").toLowerCase().includes(q) ||
      a.id.slice(0, 8).toLowerCase().includes(q);
    const matchesStatus = !statusFilter || a.status === statusFilter;
    const matchesOnline = !onlineFilter || a.onlineState === onlineFilter;
    return matchesSearch && matchesStatus && matchesOnline;
  });

  const renderItem = ({ item }: { item: Asset }) => {
    const coords = coordsMap[item.id] ?? null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/asset/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardMainRow}>
          <View
            style={[
              styles.typeIcon,
              { backgroundColor: colors.primary + "18" },
            ]}
          >
            <Feather
              name={(TYPE_ICONS[item.assetType] ?? "circle") as any} // eslint-disable-line @typescript-eslint/no-explicit-any
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {item.brand ??
                t(`assets.type_${item.assetType}`, {
                  defaultValue: item.assetType,
                })}{" "}
              {item.model ?? ""}
            </Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              {item.internalCode ?? item.id.slice(0, 8)}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <View style={styles.cardRightTop}>
              {item.batteryPercent != null && (
                <View style={styles.batteryRow}>
                  <BatteryIcon percent={item.batteryPercent} size={14} />
                  <Text
                    style={[
                      styles.batteryText,
                      { color: getBatteryColor(item.batteryPercent) },
                    ]}
                  >
                    {item.batteryPercent}%
                  </Text>
                </View>
              )}
              {(item.onlineState === "online" ||
                item.onlineState === "offline") && (
                <View
                  style={[
                    styles.connectionDot,
                    {
                      backgroundColor:
                        item.onlineState === "online" ? "#10B981" : "#EF4444",
                    },
                  ]}
                />
              )}
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    (STATUS_COLORS[item.status] ?? "#8c8c8c") + "18",
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_COLORS[item.status] ?? "#8c8c8c" },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: STATUS_COLORS[item.status] ?? "#8c8c8c" },
                ]}
              >
                {t(`assets.status_${item.status}`, {
                  defaultValue: item.status,
                })}
              </Text>
            </View>
          </View>
        </View>
        {coords && (
          <TouchableOpacity
            style={[styles.locationChip, { borderTopColor: colors.border }]}
            onPress={() => openMaps(coords.lat, coords.lng)}
            activeOpacity={0.7}
          >
            <Feather name="map-pin" size={11} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.primary }]}>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>
            {coords.cachedAt ? (
              <Text
                style={[styles.cacheAgeText, { color: colors.mutedForeground }]}
              >
                {formatRelativeTime(coords.cachedAt, t)}
              </Text>
            ) : null}
            <Feather
              name="external-link"
              size={11}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />

      <View style={styles.topRow}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              flex: 1,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t("assets.search")}
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
        {canSeeMap && (
          <TouchableOpacity
            style={[
              styles.mapBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.push("/fleet-map" as never)}
            activeOpacity={0.7}
          >
            <Feather name="map" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.chip,
            !statusFilter && { backgroundColor: colors.primary },
          ]}
          onPress={() => setStatusFilter(null)}
        >
          <Text
            style={[
              styles.chipText,
              { color: !statusFilter ? "#fff" : colors.mutedForeground },
            ]}
          >
            {t("serviceModule.all")}
          </Text>
        </TouchableOpacity>
        {STATUS_FILTER_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.chip,
              statusFilter === key && { backgroundColor: STATUS_COLORS[key] },
            ]}
            onPress={() => setStatusFilter(statusFilter === key ? null : key)}
          >
            <View
              style={[
                styles.chipDot,
                {
                  backgroundColor:
                    statusFilter === key ? "#fff" : STATUS_COLORS[key],
                },
              ]}
            />
            <Text
              style={[
                styles.chipText,
                {
                  color: statusFilter === key ? "#fff" : colors.mutedForeground,
                },
              ]}
            >
              {t(`assets.status_${key}`)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.chip,
            onlineFilter === "online" && { backgroundColor: "#10B981" },
          ]}
          onPress={() =>
            setOnlineFilter(onlineFilter === "online" ? null : "online")
          }
        >
          <View
            style={[
              styles.chipDot,
              {
                backgroundColor: onlineFilter === "online" ? "#fff" : "#10B981",
              },
            ]}
          />
          <Text
            style={[
              styles.chipText,
              {
                color:
                  onlineFilter === "online" ? "#fff" : colors.mutedForeground,
              },
            ]}
          >
            {t("assetDetail.onlineState_online")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.chip,
            onlineFilter === "offline" && { backgroundColor: "#EF4444" },
          ]}
          onPress={() =>
            setOnlineFilter(onlineFilter === "offline" ? null : "offline")
          }
        >
          <View
            style={[
              styles.chipDot,
              {
                backgroundColor:
                  onlineFilter === "offline" ? "#fff" : "#EF4444",
              },
            ]}
          />
          <Text
            style={[
              styles.chipText,
              {
                color:
                  onlineFilter === "offline" ? "#fff" : colors.mutedForeground,
              },
            ]}
          >
            {t("assetDetail.onlineState_offline")}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>
                {t("assets.noAssets")}
              </Text>
              <Text
                style={[styles.emptyHint, { color: colors.mutedForeground }]}
              >
                {t("assets.emptyHint")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(128,128,128,0.1)",
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { padding: 12, gap: 10, paddingBottom: 100 },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMainRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardRight: { alignItems: "flex-end", gap: 6 },
  cardRightTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  locationText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  cacheAgeText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  batteryRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  batteryText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
