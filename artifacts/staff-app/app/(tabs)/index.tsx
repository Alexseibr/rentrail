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
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useAppStateFocus } from "@/hooks/useAppStateFocus";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { canAccessTab } from "@/utils/permissions";
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

  const assets =
    assetsRes.status === "fulfilled" && assetsRes.value.ok
      ? (await assetsRes.value.json()).data
      : [];
  const rentals =
    rentalsRes.status === "fulfilled" && rentalsRes.value.ok
      ? (await rentalsRes.value.json()).data
      : [];
  const notifications =
    notifRes.status === "fulfilled" && notifRes.value.ok
      ? (await notifRes.value.json()).data
      : [];

  const activeRentals = Array.isArray(rentals)
    ? rentals.filter((r: { status: string }) =>
        ["active", "overdue", "extended"].includes(r.status),
      ).length
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

  return {
    activeRentals,
    overdueRentals,
    availableAssets,
    totalAssets,
    unreadNotifs,
  };
}

const STAT_CONFIG = [
  {
    key: "activeRentals",
    icon: "play-circle" as const,
    colorKey: "primary" as const,
  },
  {
    key: "overdue",
    icon: "alert-triangle" as const,
    colorKey: "destructive" as const,
  },
  {
    key: "available",
    icon: "check-circle" as const,
    colorKey: "success" as const,
  },
  { key: "totalFleet", icon: "grid" as const, colorKey: "info" as const },
];

export default function DashboardScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, companyId } = useAuth();
  const { pendingCount } = useSync();

  const memberships = user?.memberships || user?.companies;
  const roleCode =
    memberships?.find((c) => c.companyId === companyId)?.roleCode ||
    memberships?.[0]?.roleCode;

  const shouldRedirectToShift =
    !canAccessTab(roleCode, "index") && canAccessTab(roleCode, "my-shift");

  React.useEffect(() => {
    if (shouldRedirectToShift) {
      router.replace("/my-shift" as never);
    }
  }, [shouldRedirectToShift, router]);

  if (shouldRedirectToShift) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 30000,
  });

  useAppStateFocus(() => {
    refetch();
  });

  const statValues = [
    data?.activeRentals ?? 0,
    data?.overdueRentals ?? 0,
    data?.availableAssets ?? 0,
    data?.totalAssets ?? 0,
  ];

  type QuickAction = {
    label: string;
    icon: React.ComponentProps<typeof Feather>["name"];
    onPress: () => void;
    badge?: number;
    badgeColor?: string;
  };

  const quickActions: QuickAction[] = [
    {
      label: t("dashboard.scanAsset"),
      icon: "maximize",
      onPress: () => router.push("/scanner"),
    },
    {
      label: t("dashboard.newIncident"),
      icon: "alert-circle",
      onPress: () => router.push("/create-incident"),
    },
    {
      label: t("dashboard.maintenance"),
      icon: "tool",
      onPress: () => router.push("/create-maintenance"),
    },
    {
      label: t("dashboard.notifications"),
      icon: "bell",
      onPress: () => router.push("/notifications"),
      badge: data?.unreadNotifs,
    },
    ...(pendingCount > 0
      ? [
          {
            label: t("dashboard.pendingSync"),
            icon: "refresh-cw" as const,
            onPress: () => router.push("/sync-queue"),
            badge: pendingCount,
            badgeColor: "#f59e0b",
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.greeting, { color: colors.foreground }]}>
          {t("dashboard.hello", { name: user?.firstName ?? "Staff" })}
        </Text>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              {STAT_CONFIG.map((stat, i) => {
                const statColor = colors[stat.colorKey];
                return (
                  <View
                    key={stat.key}
                    style={[styles.statCard, { backgroundColor: colors.card }]}
                  >
                    <View
                      style={[
                        styles.statIconWrap,
                        { backgroundColor: statColor + "15" },
                      ]}
                    >
                      <Feather name={stat.icon} size={18} color={statColor} />
                    </View>
                    <Text
                      style={[styles.statValue, { color: colors.foreground }]}
                    >
                      {statValues[i]}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t(`dashboard.${stat.key}`)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t("dashboard.quickActions")}
            </Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.actionCard, { backgroundColor: colors.card }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    action.onPress();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionIconWrap}>
                    <View
                      style={[
                        styles.actionIconCircle,
                        { backgroundColor: colors.primary + "20" },
                      ]}
                    >
                      <Feather
                        name={action.icon}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    {action.badge && action.badge > 0 ? (
                      <View
                        style={[
                          styles.actionBadge,
                          {
                            backgroundColor:
                              action.badgeColor ?? colors.destructive,
                          },
                        ]}
                      >
                        <Text style={styles.badgeText}>{action.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.actionLabel, { color: colors.foreground }]}
                  >
                    {action.label}
                  </Text>
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
  greeting: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "48%" as unknown as number,
    flexGrow: 1,
    flexBasis: "45%",
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 28,
    marginBottom: 14,
  },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "48%" as unknown as number,
    flexGrow: 1,
    flexBasis: "45%",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconWrap: { position: "relative" },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
