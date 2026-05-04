import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { getAccessToken, getCompanyId } from "@/services/api";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Asset {
  id: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  internalCode: string | null;
  status: string;
  qrCode: string | null;
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

const STATUS_FILTER_KEYS = ["available", "rented", "maintenance", "blocked"] as const;

export default function AssetsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: assets = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["assets"],
    queryFn: fetchAssets,
    staleTime: 30000,
  });

  const filtered = assets.filter((a) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (
      (a.brand ?? "").toLowerCase().includes(q) ||
      (a.model ?? "").toLowerCase().includes(q) ||
      (a.internalCode ?? "").toLowerCase().includes(q) ||
      a.id.slice(0, 8).toLowerCase().includes(q)
    );
    const matchesStatus = !statusFilter || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderItem = ({ item }: { item: Asset }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/asset/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.typeIcon, { backgroundColor: colors.primary + "18" }]}>
        <Feather name={(TYPE_ICONS[item.assetType] ?? "circle") as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {item.brand ?? t(`assets.type_${item.assetType}`, { defaultValue: item.assetType })} {item.model ?? ""}
        </Text>
        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
          {item.internalCode ?? item.id.slice(0, 8)}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? "#8c8c8c") + "18" }]}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] ?? "#8c8c8c" }]} />
        <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? "#8c8c8c" }]}>
          {t(`assets.status_${item.status}`, { defaultValue: item.status })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              {t(`assets.status_${key}`)}
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
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>{t("assets.noAssets")}</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>{t("assets.emptyHint")}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  typeIcon: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  cardContent: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
});
