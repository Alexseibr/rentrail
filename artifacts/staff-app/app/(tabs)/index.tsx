import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { getAccessToken, getCompanyId } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function fetchDashboard() {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-company-id": companyId,
  };

  const [assetsRes, rentalsRes, notifRes] = await Promise.allSettled([
    fetch(`${BASE_URL}/api/assets`, { headers }),
    fetch(`${BASE_URL}/api/rentals`, { headers }),
    fetch(`${BASE_URL}/api/notifications`, { headers }),
  ]);

  const assets = assetsRes.status === "fulfilled" && assetsRes.value.ok
    ? (await assetsRes.value.json()).data
    : [];
  const rentals = rentalsRes.status === "fulfilled" && rentalsRes.value.ok
    ? (await rentalsRes.value.json()).data
    : [];
  const notifications = notifRes.status === "fulfilled" && notifRes.value.ok
    ? (await notifRes.value.json()).data
    : [];

  const activeRentals = Array.isArray(rentals)
    ? rentals.filter((r: { status: string }) => ["active", "overdue", "extended"].includes(r.status)).length
    : 0;
  const overdueRentals = Array.isArray(rentals)
    ? rentals.filter((r: { status: string }) => r.status === "overdue").length
    : 0;
  const availableAssets = Array.isArray(assets)
    ? assets.filter((a: { status: string }) => a.status === "available").length
    : 0;
  const totalAssets = Array.isArray(assets) ? assets.length : 0;
  const unreadNotifs = Array.isArray(notifications)
    ? notifications.filter((n: { readAt: string | null }) => !n.readAt).length
    : 0;

  return { activeRentals, overdueRentals, availableAssets, totalAssets, unreadNotifs };
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 30000,
  });

  const stats = [
    { label: "Active Rentals", value: data?.activeRentals ?? 0, icon: "play-circle" as const, color: colors.primary },
    { label: "Overdue", value: data?.overdueRentals ?? 0, icon: "alert-triangle" as const, color: colors.destructive },
    { label: "Available", value: data?.availableAssets ?? 0, icon: "check-circle" as const, color: colors.success },
    { label: "Total Fleet", value: data?.totalAssets ?? 0, icon: "grid" as const, color: colors.info },
  ];

  const quickActions = [
    { label: "Scan Asset", icon: "maximize" as const, onPress: () => router.push("/scanner") },
    { label: "New Incident", icon: "alert-circle" as const, onPress: () => router.push("/create-incident") },
    { label: "Maintenance", icon: "tool" as const, onPress: () => router.push("/create-maintenance") },
    { label: "Notifications", icon: "bell" as const, onPress: () => router.push("/notifications"), badge: data?.unreadNotifs },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        <Text style={[styles.greeting, { color: colors.foreground }]}>
          {`Hello, ${user?.firstName ?? "Staff"}`}
        </Text>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name={stat.icon} size={20} color={stat.color} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    action.onPress();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionIconWrap}>
                    <Feather name={action.icon} size={22} color={colors.primary} />
                    {action.badge && action.badge > 0 ? (
                      <View style={[styles.actionBadge, { backgroundColor: colors.destructive }]}>
                        <Text style={styles.badgeText}>{action.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },
  greeting: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "48%" as unknown as number,
    flexGrow: 1,
    flexBasis: "45%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginTop: 24, marginBottom: 12 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: {
    width: "48%" as unknown as number,
    flexGrow: 1,
    flexBasis: "45%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  actionIconWrap: { position: "relative" },
  actionBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  actionLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
