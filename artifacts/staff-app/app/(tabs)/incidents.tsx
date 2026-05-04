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

interface ServiceRequest {
  id: string;
  requestType: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  assetCode: string | null;
  assetType: string | null;
  branchName: string | null;
  reportedByName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f59e0b",
  critical: "#ef4444",
  urgent: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  in_progress: "#f59e0b",
  resolved: "#22c55e",
  closed: "#94a3b8",
};

async function fetchServiceRequests(companyId: string): Promise<ServiceRequest[]> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/service-requests`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Failed to fetch incidents");
  const json = await res.json();
  return json.data;
}

export default function IncidentsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { companyId } = useAuth();

  const [manualRefreshing, setManualRefreshing] = React.useState(false);

  const { data: items = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["incidents", companyId],
    queryFn: () => fetchServiceRequests(companyId!),
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

  const renderItem = ({ item }: { item: ServiceRequest }) => {
    const priorityColor = SEVERITY_COLORS[item.priority] ?? "#94a3b8";
    const statusColor = STATUS_COLORS[item.status] ?? "#94a3b8";
    const isUrgent = item.priority === "urgent" || item.priority === "critical";

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/incident/${item.id}` as `/incident/${string}`);
        }}
        style={[styles.card, { backgroundColor: colors.card }]}
      >
        <View style={[styles.cardAccent, { backgroundColor: priorityColor }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              {isUrgent ? (
                <Feather name="alert-triangle" size={14} color={priorityColor} />
              ) : (
                <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
              )}
              <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {t(`incidents.status_${item.status}`, { defaultValue: item.status })}
              </Text>
            </View>
          </View>

          {item.description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            {item.assetCode ? (
              <View style={styles.metaItem}>
                <Feather name="cpu" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.assetCode}</Text>
              </View>
            ) : null}
            {item.requestType ? (
              <View style={styles.metaItem}>
                <Feather name="tag" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {t(`incidents.type_${item.requestType}`, { defaultValue: item.requestType })}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
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
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>{t("incidents.listTitle")}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/create-incident");
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
              <Feather name="check-circle" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {t("incidents.noIncidents")}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                {t("incidents.noIncidentsHint")}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
