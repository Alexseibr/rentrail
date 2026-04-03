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

interface Rental {
  id: string;
  status: string;
  rentalType: string;
  createdAt: string;
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

const STATUS_COLORS: Record<string, string> = {
  active: "#43A047",
  overdue: "#E53935",
  completed: "#8c8c8c",
  draft: "#8c8c8c",
  pending_approval: "#FF9800",
  awaiting_payment: "#FF9800",
  awaiting_pickup: "#1E88E5",
  canceled: "#8c8c8c",
};

export default function RentalsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { data: rentals = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rentals"],
    queryFn: fetchRentals,
    staleTime: 30000,
  });

  const renderItem = ({ item }: { item: Rental }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/rental/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary + "18" }]}>
        <Feather name="file-text" size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {item.rentalType} {t("rentals.rental")}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] ?? "#8c8c8c") + "18" }]}>
        <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] ?? "#8c8c8c" }]}>
          {item.status.replace(/_/g, " ")}
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
          data={rentals}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          scrollEnabled={rentals.length > 0}
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
  icon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
