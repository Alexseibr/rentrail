import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  assigned: "#3b82f6",
  en_route: "#8b5cf6",
  in_progress: "#f59e0b",
  waiting_parts: "#ef4444",
  completed: "#22c55e",
  canceled: "#94a3b8",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};

async function fetchWorkOrders(companyId: string, status?: string) {
  const token = await getAccessToken();
  const url = `${BASE_URL}/api/work-orders${status ? `?status=${status}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Failed to fetch work orders");
  const json = await res.json();
  return json.data as any[];
}

export default function WorkOrdersScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await fetchWorkOrders(companyId, filter);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, filter]);

  React.useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = search.trim()
    ? items.filter(i =>
        i.title?.toLowerCase().includes(search.toLowerCase()) ||
        i.assetCode?.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const FILTERS: { key: string | undefined; label: string }[] = [
    { key: undefined, label: t("serviceModule.all") },
    { key: "assigned", label: t("serviceModule.statusAssigned") },
    { key: "en_route", label: t("serviceModule.status_en_route") },
    { key: "in_progress", label: t("serviceModule.statusInProgress") },
    { key: "waiting_parts", label: t("serviceModule.statusWaitingParts") },
    { key: "completed", label: t("serviceModule.statusCompleted") },
  ];

  const ACTIVE_STATUSES = ["assigned", "en_route", "in_progress", "waiting_parts"];

  const renderItem = ({ item }: { item: any }) => {
    const isActive = ACTIVE_STATUSES.includes(item.status);
    const isUrgent = item.priority === "urgent";
    const accentColor = STATUS_COLORS[item.status] ?? "#94a3b8";

    return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }, isActive && styles.cardActive]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/service/work-order/${item.id}` as any);
      }}
      activeOpacity={0.7}
    >
      {isActive && <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          {isUrgent ? (
            <Feather name="alert-triangle" size={14} color={PRIORITY_COLORS.urgent} />
          ) : (
            <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] ?? "#94a3b8" }]} />
          )}
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? "#94a3b8") + "20" }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? colors.mutedForeground }]}>
            {t(`serviceModule.status_${item.status}`, { defaultValue: item.status })}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {item.assetCode && (
          <View style={styles.metaItem}>
            <Feather name="cpu" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.assetCode}</Text>
          </View>
        )}
        {item.orderType && (
          <View style={styles.metaItem}>
            <Feather name="tool" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {t(`serviceModule.type_${item.orderType}`, { defaultValue: item.orderType })}
            </Text>
          </View>
        )}
        {item.assignedToName && item.assignedToName.trim() !== "" && (
          <View style={styles.metaItem}>
            <Feather name="user" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.assignedToName}</Text>
          </View>
        )}
        {item.priority && (
          <View style={styles.metaItem}>
            <View style={[styles.priorityMiniDot, { backgroundColor: PRIORITY_COLORS[item.priority] ?? "#94a3b8" }]} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {t(`serviceModule.priority_${item.priority}`, { defaultValue: item.priority })}
            </Text>
          </View>
        )}
      </View>

      {item.estimatedCost && (
        <Text style={[styles.costText, { color: colors.mutedForeground }]}>
          {t("serviceModule.estimated")}: {parseFloat(item.estimatedCost).toLocaleString("ru-RU")} ₽
        </Text>
      )}
    </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.dark }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("serviceModule.workOrders")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t("serviceModule.searchPlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          const activeColor = f.key ? (STATUS_COLORS[f.key] ?? colors.primary) : colors.primary;
          return (
            <TouchableOpacity
              key={String(f.key)}
              style={[
                styles.chip,
                isActive && { backgroundColor: activeColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f.key);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: isActive ? "#fff" : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <Feather name="tool" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("serviceModule.noWorkOrders")}</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>{t("serviceModule.noWorkOrdersHint")}</Text>
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
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: "rgba(128,128,128,0.1)",
  },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { padding: 12, paddingBottom: 60 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: "hidden",
  },
  cardActive: {
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityMiniDot: { width: 6, height: 6, borderRadius: 3 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  costText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  loader: { marginTop: 60 },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
});
