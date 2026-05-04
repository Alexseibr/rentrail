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
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface MaintenanceLog {
  id: string;
  assetId: string;
  assetCode: string | null;
  assetType: string | null;
  branchId: string | null;
  logType: string;
  performedAt: string;
  performedByName: string | null;
  odometerKm: string | null;
  cost: string | null;
  notes: string | null;
  nextServiceDate: string | null;
}

const LOG_TYPE_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  general_service: "tool",
  tire_change: "disc",
  brake_service: "alert-circle",
  battery_replacement: "battery-charging",
  chain_lubrication: "link",
  cable_adjustment: "sliders",
  bearing_replacement: "settings",
  body_repair: "shield",
  electrical_repair: "zap",
  cleaning: "wind",
  inspection: "eye",
  other: "more-horizontal",
};

async function fetchMaintenanceLogs(companyId: string): Promise<MaintenanceLog[]> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/maintenance-logs?limit=50`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Failed to fetch maintenance logs");
  const json = await res.json();
  return json.data;
}

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { companyId } = useAuth();

  const [manualRefreshing, setManualRefreshing] = React.useState(false);

  const { data: items = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["maintenanceLogs", companyId],
    queryFn: () => fetchMaintenanceLogs(companyId!),
    enabled: !!companyId,
    staleTime: 20000,
    refetchInterval: 30000,
  });

  React.useEffect(() => {
    if (!isRefetching) setManualRefreshing(false);
  }, [isRefetching]);

  const onRefresh = () => {
    setManualRefreshing(true);
    refetch();
  };

  const renderItem = ({ item }: { item: MaintenanceLog }) => {
    const iconName = LOG_TYPE_ICONS[item.logType] ?? "tool";

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
          <Feather name={iconName} size={18} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.logType, { color: colors.foreground }]}>
              {t(`serviceModule.logType_${item.logType}`, { defaultValue: item.logType })}
            </Text>
            {item.assetCode ? (
              <Text style={[styles.assetCode, { color: colors.primary }]}>{item.assetCode}</Text>
            ) : null}
          </View>

          {item.notes ? (
            <Text style={[styles.notes, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {new Date(item.performedAt).toLocaleDateString()}
              </Text>
            </View>
            {item.cost && parseFloat(item.cost) > 0 ? (
              <View style={styles.metaItem}>
                <Feather name="dollar-sign" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {parseFloat(item.cost).toLocaleString()}
                </Text>
              </View>
            ) : null}
            {item.odometerKm ? (
              <View style={styles.metaItem}>
                <Feather name="activity" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {parseFloat(item.odometerKm).toLocaleString()} km
                </Text>
              </View>
            ) : null}
            {item.performedByName ? (
              <View style={styles.metaItem}>
                <Feather name="user" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.performedByName}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
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
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>{t("maintenance.listTitle")}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/create-maintenance");
          }}
        >
          <Feather name="plus" size={22} color={colors.primary} />
        </TouchableOpacity>
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
                {t("maintenance.noLogs")}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                {t("maintenance.noLogsHint")}
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
  addBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "flex-end" },
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
    marginBottom: 4,
  },
  logType: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  assetCode: { fontSize: 12, fontFamily: "Inter_700Bold" },
  notes: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
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
