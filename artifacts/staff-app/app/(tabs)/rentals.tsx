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
  active: "#10b981",
  overdue: "#ef4444",
  completed: "#6b7280",
  draft: "#6b7280",
  pending_approval: "#f59e0b",
  awaiting_payment: "#f59e0b",
  awaiting_pickup: "#3b82f6",
  canceled: "#6b7280",
};

export default function RentalsScreen() {
  const colors = useColors();
  const router = useRouter();

  const { data: rentals = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rentals"],
    queryFn: fetchRentals,
    staleTime: 30000,
  });

  const renderItem = ({ item }: { item: Rental }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/rental/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Feather name="file-text" size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {item.rentalType} rental
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] ?? "#6b7280") + "20" }]}>
        <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] ?? "#6b7280" }]}>
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
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No rentals found</Text>
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
  icon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "capitalize" as const },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
