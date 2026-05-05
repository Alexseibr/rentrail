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
import { readManyCoordsFromCache } from "@/services/coordsCache";
import { CachedCoordinates } from "@/hooks/useCachedCoordinates";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Rental {
  id: string;
  status: string;
  rentalType: string;
  createdAt: string;
  assetId: string | null;
}

async function fetchRentals(): Promise<Rental[]> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return [];

  const res = await fetch(`${BASE_URL}/api/rentals`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return [];
  const { data } = await res.json();
  return data;
}

function formatRelativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("rentalDetail.timeJustNow");
  if (minutes < 60) return t("rentalDetail.timeMinutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("rentalDetail.timeHoursAgo", { count: hours });
  return t("rentalDetail.timeDaysAgo", { count: Math.floor(hours / 24) });
}

const STATUS_COLORS: Record<string, string> = {
  active: "#43A047",
  overdue: "#E53935",
  completed: "#8c8c8c",
  draft: "#8c8c8c",
  pending_approval: "#FF9800",
  awaiting_payment: "#FF9800",
  awaiting_pickup: "#1E88E5",
  canceled: "#8c8c8c",
  cancelled: "#8c8c8c",
};

const STATUS_FILTER_KEYS = ["active", "overdue", "awaiting_pickup", "pending_approval"] as const;

function openMaps(lat: number, lng: number) {
  const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
  const webUrl = `https://maps.google.com/?q=${lat},${lng}`;
  Linking.canOpenURL(geoUrl)
    .then((ok) => Linking.openURL(ok ? geoUrl : webUrl))
    .catch(() => Linking.openURL(webUrl).catch(() => {}));
}

export default function RentalsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [coordsMap, setCoordsMap] = useState<Record<string, CachedCoordinates>>({});

  const { data: rentals = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rentals"],
    queryFn: fetchRentals,
    staleTime: 30000,
  });

  useAppStateFocus(() => { refetch(); });

  useEffect(() => {
    const assetIds = rentals
      .map((r) => r.assetId)
      .filter((id): id is string => !!id);
    if (assetIds.length === 0) return;
    readManyCoordsFromCache(assetIds).then(setCoordsMap);
  }, [rentals]);

  const filtered = rentals.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (
      r.status.toLowerCase().includes(q) ||
      r.rentalType.toLowerCase().includes(q) ||
      r.id.slice(0, 8).toLowerCase().includes(q)
    );
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderItem = ({ item }: { item: Rental }) => {
    const coords = item.assetId ? (coordsMap[item.assetId] ?? null) : null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/rental/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardMainRow}>
          <View style={[styles.icon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="file-text" size={18} color={colors.primary} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t(`rentals.type_${item.rentalType}`, { defaultValue: item.rentalType })}
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {new Date(item.createdAt).toLocaleDateString("ru-RU")}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] ?? "#8c8c8c") + "18" }]}>
            <View style={[styles.badgeDot, { backgroundColor: STATUS_COLORS[item.status] ?? "#8c8c8c" }]} />
            <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] ?? "#8c8c8c" }]}>
              {t(`rentals.status_${item.status}`, { defaultValue: item.status })}
            </Text>
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
              <Text style={[styles.cacheAgeText, { color: colors.mutedForeground }]}>
                {formatRelativeTime(coords.cachedAt, t)}
              </Text>
            ) : null}
            <Feather name="external-link" size={11} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t("rentals.search")}
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

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, !statusFilter && { backgroundColor: colors.primary }]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.chipText, { color: !statusFilter ? "#fff" : colors.mutedForeground }]}>
            {t("serviceModule.all")}
          </Text>
        </TouchableOpacity>
        {STATUS_FILTER_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, statusFilter === key && { backgroundColor: STATUS_COLORS[key] }]}
            onPress={() => setStatusFilter(statusFilter === key ? null : key)}
          >
            <View style={[styles.chipDot, { backgroundColor: statusFilter === key ? "#fff" : STATUS_COLORS[key] }]} />
            <Text style={[styles.chipText, { color: statusFilter === key ? "#fff" : colors.mutedForeground }]}>
              {t(`rentals.status_${key}`)}
            </Text>
          </TouchableOpacity>
        ))}
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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="file" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("rentals.noRentals")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterRow: {
    flexDirection: "row", gap: 6, paddingHorizontal: 12,
    paddingBottom: 10, flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: "rgba(128,128,128,0.1)",
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
  icon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
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
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
