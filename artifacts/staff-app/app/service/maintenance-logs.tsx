import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const LOG_TYPE_ICONS: Record<string, string> = {
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

async function fetchLogs(companyId: string, assetId?: string, limit = 50) {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (assetId) params.set("assetId", assetId);
  params.set("limit", String(limit));
  const res = await fetch(`${BASE_URL}/api/maintenance-logs?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  const json = await res.json();
  return json.data as any[];
}

export default function MaintenanceLogsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await fetchLogs(companyId);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  React.useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = search.trim()
    ? logs.filter(l =>
        l.assetCode?.toLowerCase().includes(search.toLowerCase()) ||
        l.notes?.toLowerCase().includes(search.toLowerCase()) ||
        l.logType?.toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  const renderItem = ({ item }: { item: any }) => {
    const iconName = (LOG_TYPE_ICONS[item.logType] ?? "tool") as React.ComponentProps<typeof Feather>["name"];
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
            <Feather name={iconName} size={18} color={colors.primary} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.logType, { color: colors.foreground }]}>
              {t(`serviceModule.logType_${item.logType}`, { defaultValue: item.logType })}
            </Text>
            {item.assetCode && (
              <Text style={[styles.assetCode, { color: colors.primary }]}>{item.assetCode}</Text>
            )}
          </View>
          {item.notes ? (
            <Text style={[styles.notes, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
          <View style={styles.cardMeta}>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {new Date(item.performedAt).toLocaleDateString("ru-RU")}
            </Text>
            {item.cost && parseFloat(item.cost) > 0 && (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                · {parseFloat(item.cost).toLocaleString("ru-RU")} ₽
              </Text>
            )}
            {item.odometerKm && (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                · {parseFloat(item.odometerKm).toLocaleString("ru-RU")} км
              </Text>
            )}
            {item.performedByName && (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                · {item.performedByName}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.dark }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("serviceModule.maintenanceLogs")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t("serviceModule.searchLogs")}
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
              <View style={styles.emptyIconWrap}>
                <Feather name="clipboard" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("serviceModule.noLogs")}</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>{t("serviceModule.noLogsHint")}</Text>
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
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  list: { padding: 12, paddingBottom: 60 },
  card: {
    flexDirection: "row", gap: 12, borderRadius: 16, padding: 14, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardLeft: { paddingTop: 2 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  logType: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  assetCode: { fontSize: 12, fontFamily: "Inter_700Bold" },
  notes: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 6 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  loader: { marginTop: 60 },
  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: "#F5C51815",
    justifyContent: "center", alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
});
