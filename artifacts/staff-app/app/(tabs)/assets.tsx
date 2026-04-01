import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
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
  available: "#10b981",
  rented: "#3b82f6",
  maintenance: "#f59e0b",
  blocked: "#ef4444",
  draft: "#6b7280",
  retired: "#6b7280",
};

const TYPE_ICONS: Record<string, string> = {
  bike: "circle",
  ebike: "zap",
  scooter: "wind",
  escooter: "activity",
};

export default function AssetsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { data: assets = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["assets"],
    queryFn: fetchAssets,
    staleTime: 30000,
  });

  const renderItem = ({ item }: { item: Asset }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/asset/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.typeIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={(TYPE_ICONS[item.assetType] ?? "circle") as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {item.brand ?? item.assetType} {item.model ?? ""}
        </Text>
        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
          {item.internalCode ?? item.id.slice(0, 8)}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? "#6b7280") + "20" }]}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] ?? "#6b7280" }]} />
        <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? "#6b7280" }]}>
          {item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          scrollEnabled={assets.length > 0}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("assets.noAssets")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "capitalize" as const },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
