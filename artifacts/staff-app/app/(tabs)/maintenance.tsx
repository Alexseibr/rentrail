import React from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAppStateFocus } from "@/hooks/useAppStateFocus";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const MAINTENANCE_ORDER_TYPES = new Set([
  "scheduled_maintenance",
  "inspection",
  "cleaning",
  "recovery",
]);

interface WorkOrder {
  id: string;
  title: string;
  orderType: string;
  status: string;
  priority: string;
  assetCode: string | null;
  assetType: string | null;
  branchName: string | null;
  assignedToName: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  assigned: "#3b82f6",
  en_route: "#8b5cf6",
  in_progress: "#f59e0b",
  waiting_parts: "#ef4444",
  completed: "#22c55e",
  canceled: "#94a3b8",
};

const ORDER_TYPE_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  scheduled_maintenance: "tool",
  inspection: "eye",
  cleaning: "wind",
  recovery: "truck",
  field_repair: "zap",
  workshop_repair: "settings",
};

async function fetchWorkOrders(companyId: string): Promise<WorkOrder[]> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/work-orders`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Failed to fetch work orders");
  const json = await res.json();
  return (json.data as WorkOrder[]).filter((wo) => MAINTENANCE_ORDER_TYPES.has(wo.orderType));
}

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { companyId } = useAuth();

  const [manualRefreshing, setManualRefreshing] = React.useState(false);

  const { data: items = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["maintenanceWorkOrders", companyId],
    queryFn: () => fetchWorkOrders(companyId!),
    enabled: !!companyId,
    staleTime: 20000,
    refetchInterval: 30000,
  });

  useAppStateFocus(() => { refetch(); });

  React.useEffect(() => {
    if (!isRefetching) setManualRefreshing(false);
  }, [isRefetching]);

  const onRefresh = () => {
    setManualRefreshing(true);
    refetch();
  };

  const renderItem = ({ item }: { item: WorkOrder }) => {
    const iconName = ORDER_TYPE_ICONS[item.orderType] ?? "tool";
    const statusColor = STATUS_COLORS[item.status] ?? "#94a3b8";

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/maintenance/${item.id}` as Parameters<typeof router.push>[0]);
        }}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
          <Feather name={iconName} size={18} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.orderTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {t(`serviceModule.status_${item.status}`, { defaultValue: item.status })}
              </Text>
            </View>
          </View>

          <Text style={[styles.orderType, { color: colors.mutedForeground }]}>
            {t(`serviceModule.type_${item.orderType}`, { defaultValue: item.orderType })}
          </Text>

          <View style={styles.metaRow}>
            {item.assetCode ? (
              <View style={styles.metaItem}>
                <Feather name="cpu" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.assetCode}</Text>
              </View>
            ) : null}
            {item.assignedToName?.trim() ? (
              <View style={styles.metaItem}>
                <Feather name="user" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.assignedToName}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />
      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>
          {t("maintenance.listTitle")}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={manualRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="tool" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {t("maintenance.noTasks")}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                {t("maintenance.noTasksHint")}
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  screenTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    borderRadius: 16,
    marginBottom: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  orderTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  orderType: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chevron: { flexShrink: 0 },
  loader: { marginTop: 60 },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
