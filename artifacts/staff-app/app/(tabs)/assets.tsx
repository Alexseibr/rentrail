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
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/asset/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.typeIcon, { backgroundColor: colors.primary + "18" }]}>
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
      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? "#8c8c8c") + "18" }]}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] ?? "#8c8c8c" }]} />
        <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? "#8c8c8c" }]}>
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
    borderRadius: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
