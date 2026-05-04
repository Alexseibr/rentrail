import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const RED = "#ef4444";
const YELLOW = "#f59e0b";
const GREEN = "#22c55e";

async function fetchSchedules(companyId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/maintenance-schedules`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  const json = await res.json();
  return json.data as any[];
}

async function fetchOverdue(companyId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/maintenance-schedules/overdue`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  const json = await res.json();
  return json.data as any[];
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function SchedulesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();

  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const {
    data: schedules = [],
    isLoading: schedulesLoading,
    isRefetching: schedulesRefetching,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ["maintenanceSchedules", companyId],
    queryFn: () => fetchSchedules(companyId!),
    enabled: !!companyId,
    staleTime: 20000,
    refetchInterval: 30000,
  });

  const {
    data: overdue = [],
    isLoading: overdueLoading,
    isRefetching: overdueRefetching,
    refetch: refetchOverdue,
  } = useQuery({
    queryKey: ["maintenanceSchedulesOverdue", companyId],
    queryFn: () => fetchOverdue(companyId!),
    enabled: !!companyId,
    staleTime: 20000,
    refetchInterval: 30000,
  });

  const isLoading = schedulesLoading || overdueLoading;
  const isRefetching = schedulesRefetching || overdueRefetching;

  React.useEffect(() => {
    if (!isRefetching) setManualRefreshing(false);
  }, [isRefetching]);

  const onRefresh = () => {
    setManualRefreshing(true);
    refetchSchedules();
    refetchOverdue();
  };

  const displayed = showOverdueOnly ? overdue : schedules;

  const getUrgency = (item: any): "overdue" | "soon" | "ok" => {
    const days = daysUntil(item.nextDueAt);
    if (days !== null && days < 0) return "overdue";
    if (days !== null && days <= 7) return "soon";
    return "ok";
  };

  const urgencyColor = (u: "overdue" | "soon" | "ok") => {
    if (u === "overdue") return RED;
    if (u === "soon") return YELLOW;
    return GREEN;
  };

  const renderItem = ({ item }: { item: any }) => {
    const urgency = getUrgency(item);
    const color = urgencyColor(urgency);
    const days = daysUntil(item.nextDueAt);

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderLeftColor: color, borderLeftWidth: 3 }]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scheduleName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
            {item.assetCode && (
              <Text style={[styles.assetCode, { color: colors.primary }]}>{item.assetCode}</Text>
            )}
          </View>
          <View style={[styles.urgencyBadge, { backgroundColor: color + "18" }]}>
            {urgency === "overdue" ? (
              <Feather name="alert-triangle" size={12} color={color} />
            ) : urgency === "soon" ? (
              <Feather name="clock" size={12} color={color} />
            ) : (
              <Feather name="check-circle" size={12} color={color} />
            )}
            <Text style={[styles.urgencyText, { color }]}>
              {days === null
                ? t("serviceModule.noDate")
                : days < 0
                ? t("serviceModule.overdueDays", { days: Math.abs(days) })
                : days === 0
                ? t("serviceModule.dueToday")
                : t("serviceModule.dueDays", { days })}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          {item.nextDueAt && (
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {new Date(item.nextDueAt).toLocaleDateString("ru-RU")}
              </Text>
            </View>
          )}
          {item.nextDueKm && (
            <View style={styles.metaItem}>
              <Feather name="activity" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {parseFloat(item.nextDueKm).toLocaleString("ru-RU")} км
              </Text>
            </View>
          )}
          {item.intervalDays && (
            <View style={styles.metaItem}>
              <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {t("serviceModule.everyDays", { days: item.intervalDays })}
              </Text>
            </View>
          )}
          {item.intervalKm && (
            <View style={styles.metaItem}>
              <Feather name="map" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {t("serviceModule.everyKm", { km: parseFloat(item.intervalKm).toLocaleString("ru-RU") })}
              </Text>
            </View>
          )}
        </View>

        {item.lastDoneAt && (
          <Text style={[styles.lastDone, { color: colors.mutedForeground }]}>
            {t("serviceModule.lastDone")}: {new Date(item.lastDoneAt).toLocaleDateString("ru-RU")}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.dark }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("serviceModule.schedules")}</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowOverdueOnly(v => !v);
          }}
          style={[styles.filterBtn, showOverdueOnly && { backgroundColor: RED + "30" }]}
        >
          <Feather name="alert-triangle" size={18} color={showOverdueOnly ? RED : "#ffffff80"} />
        </TouchableOpacity>
      </View>

      {overdue.length > 0 && !showOverdueOnly && (
        <TouchableOpacity
          style={[styles.overdueBar, { backgroundColor: RED + "15", borderColor: RED + "40" }]}
          onPress={() => setShowOverdueOnly(true)}
          activeOpacity={0.7}
        >
          <Feather name="alert-triangle" size={14} color={RED} />
          <Text style={[styles.overdueBarText, { color: RED }]}>
            {t("serviceModule.overdueCount", { count: overdue.length })}
          </Text>
          <Feather name="chevron-right" size={14} color={RED} />
        </TouchableOpacity>
      )}

      <FlatList
        data={displayed}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <Feather name="calendar" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {showOverdueOnly ? t("serviceModule.noOverdue") : t("serviceModule.noSchedules")}
              </Text>
            </View>
          )
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff" },
  filterBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 10 },
  overdueBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginTop: 12, padding: 12,
    borderRadius: 12, borderWidth: 1,
  },
  overdueBarText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { padding: 12, paddingBottom: 60 },
  card: {
    borderRadius: 16, padding: 14, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  scheduleName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  assetCode: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 2 },
  urgencyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  urgencyText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  lastDone: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  loader: { marginTop: 60 },
  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
