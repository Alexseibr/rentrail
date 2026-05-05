import React, { useMemo, useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAppStateFocus } from "@/hooks/useAppStateFocus";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { readManyCoordsFromCache } from "@/services/coordsCache";
import { CachedCoordinates } from "@/hooks/useCachedCoordinates";
import i18n from "@/i18n/i18n";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface WorkOrder {
  id: string;
  companyId: string;
  branchId: string | null;
  serviceRequestId: string | null;
  assetId: string | null;
  orderType: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  assignedToUserId: string | null;
  estimatedCost: string | null;
  actualCost: string | null;
  resolution: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assetCode: string | null;
  assetType: string | null;
  branchName: string | null;
  branchCity: string | null;
  assignedToName: string | null;
}

type ColorTokens = ReturnType<typeof useColors>;

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

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function formatRelativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("rentalDetail.timeJustNow");
  if (minutes < 60) return t("rentalDetail.timeMinutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("rentalDetail.timeHoursAgo", { count: hours });
  return t("rentalDetail.timeDaysAgo", { count: Math.floor(hours / 24) });
}

function openMaps(lat: number, lng: number) {
  const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
  const webUrl = `https://maps.google.com/?q=${lat},${lng}`;
  Linking.canOpenURL(geoUrl)
    .then((ok) => Linking.openURL(ok ? geoUrl : webUrl))
    .catch(() => Linking.openURL(webUrl).catch(() => {}));
}

async function fetchMyWorkOrders(companyId: string, userId: string): Promise<WorkOrder[]> {
  const token = await getAccessToken();
  const url = `${BASE_URL}/api/work-orders?assignedToUserId=${userId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Failed to fetch work orders");
  const json = await res.json();
  return json.data;
}

function getTimeAgo(dateStr: string, t: TFunction): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("myShift.justNow");
  if (mins < 60) return t("myShift.timeAgo", { time: t("myShift.minutesShort", { m: mins }) });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("myShift.timeAgo", { time: t("myShift.hoursShort", { h: hours }) });
  const days = Math.floor(hours / 24);
  return t("myShift.timeAgo", { time: t("myShift.daysShort", { d: days }) });
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

interface KpiCardProps {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Feather.glyphMap;
  colors: ColorTokens;
}

function KpiCard({ label, value, color, icon, colors }: KpiCardProps) {
  return (
    <View style={[kpiStyles.card, { backgroundColor: colors.card }]}>
      <View style={[kpiStyles.iconWrap, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[kpiStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[kpiStyles.label, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  value: { fontSize: 26, fontFamily: "Inter_700Bold" },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

export default function MyShiftScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { user, companyId } = useAuth();

  const [completedExpanded, setCompletedExpanded] = React.useState(false);
  const [manualRefreshing, setManualRefreshing] = React.useState(false);
  const [coordsMap, setCoordsMap] = useState<Record<string, CachedCoordinates>>({});

  const { data: items = [], isLoading: loading, isRefetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["myShiftWorkOrders", companyId, user?.id],
    queryFn: () => fetchMyWorkOrders(companyId!, user!.id),
    enabled: !!companyId && !!user?.id,
    staleTime: 20000,
    refetchInterval: 30000,
  });

  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  useAppStateFocus(() => {
    refetch();
    const ids = itemsRef.current
      .map((o) => o.assetId)
      .filter((id): id is string => !!id);
    if (ids.length > 0) {
      readManyCoordsFromCache(ids).then(setCoordsMap);
    }
  });

  useEffect(() => {
    const ids = items
      .map((o) => o.assetId)
      .filter((id): id is string => !!id);
    if (ids.length === 0) return;
    readManyCoordsFromCache(ids).then(setCoordsMap);
  }, [items]);

  React.useEffect(() => {
    if (!isRefetching) setManualRefreshing(false);
  }, [isRefetching]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const diffSec = Math.floor((now - dataUpdatedAt) / 1000);
    if (diffSec < 15) return t("myShift.justUpdated");
    if (diffSec < 60) return t("myShift.updatedAgo", { time: t("myShift.secondsShort", { s: diffSec }) });
    const diffMin = Math.floor(diffSec / 60);
    return t("myShift.updatedAgo", { time: t("myShift.minutesShort", { m: diffMin }) });
  }, [dataUpdatedAt, now, t]);

  const onRefresh = () => {
    setManualRefreshing(true);
    refetch();
  };

  const { inProgressCount, assignedCount, waitingPartsCount, activeOrders, completedToday } = useMemo(() => {
    let ip = 0, assigned = 0, wp = 0;
    const active: WorkOrder[] = [];
    const completed: WorkOrder[] = [];

    for (const item of items) {
      switch (item.status) {
        case "in_progress": ip++; active.push(item); break;
        case "assigned": assigned++; active.push(item); break;
        case "waiting_parts": wp++; break;
        case "completed":
          if (item.completedAt && isToday(item.completedAt)) {
            completed.push(item);
          }
          break;
      }
    }

    active.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
    completed.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

    return {
      inProgressCount: ip,
      assignedCount: assigned,
      waitingPartsCount: wp,
      activeOrders: active,
      completedToday: completed.slice(0, 5),
    };
  }, [items]);

  const navigateToOrder = (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/service/work-order/${orderId}` as `/service/work-order/${string}`);
  };

  const renderOrderCard = ({ item }: { item: WorkOrder }) => {
    const isUrgent = item.priority === "urgent";
    const accentColor = STATUS_COLORS[item.status] ?? "#94a3b8";
    const coords = item.assetId ? (coordsMap[item.assetId] ?? null) : null;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => navigateToOrder(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
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
          <View style={[styles.statusBadge, { backgroundColor: accentColor + "20" }]}>
            <Text style={[styles.statusText, { color: accentColor }]}>
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
          {item.createdAt && (
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {getTimeAgo(item.createdAt, t)}
              </Text>
            </View>
          )}
        </View>

        {coords && (
          <TouchableOpacity
            style={[styles.locationChip, { borderTopColor: colors.border }]}
            onPress={() => openMaps(coords.lat, coords.lng)}
            activeOpacity={0.7}
          >
            <Feather name="map-pin" size={11} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.primary }]}>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>
            {coords.cachedAt ? (
              <Text style={[styles.cacheAgeText, { color: colors.mutedForeground }]}>
                {formatRelativeTime(coords.cachedAt, t)}
              </Text>
            ) : null}
            <Feather name="external-link" size={11} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderCompletedCard = (item: WorkOrder) => {
    const coords = item.assetId ? (coordsMap[item.assetId] ?? null) : null;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.completedCard, { backgroundColor: colors.card }]}
        onPress={() => navigateToOrder(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.completedRow}>
          <View style={[styles.completedDot, { backgroundColor: STATUS_COLORS.completed }]} />
          <View style={styles.completedInfo}>
            <Text style={[styles.completedTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.completedMeta}>
              {item.assetCode && (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.assetCode}</Text>
              )}
              {item.completedAt && (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {new Date(item.completedAt).toLocaleTimeString(i18n.language === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              )}
            </View>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>

        {coords && (
          <TouchableOpacity
            style={[styles.locationChip, { borderTopColor: colors.border }]}
            onPress={() => openMaps(coords.lat, coords.lng)}
            activeOpacity={0.7}
          >
            <Feather name="map-pin" size={11} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.primary }]}>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>
            {coords.cachedAt ? (
              <Text style={[styles.cacheAgeText, { color: colors.mutedForeground }]}>
                {formatRelativeTime(coords.cachedAt, t)}
              </Text>
            ) : null}
            <Feather name="external-link" size={11} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.kpiRow}>
        <KpiCard
          label={t("myShift.inProgress")}
          value={inProgressCount}
          color="#f59e0b"
          icon="zap"
          colors={colors}
        />
        <KpiCard
          label={t("myShift.assignedToMe")}
          value={assignedCount}
          color="#3b82f6"
          icon="inbox"
          colors={colors}
        />
        <KpiCard
          label={t("myShift.waitingParts")}
          value={waitingPartsCount}
          color="#ef4444"
          icon="package"
          colors={colors}
        />
      </View>

      {lastUpdatedLabel ? (
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
          {lastUpdatedLabel}
        </Text>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {t("myShift.urgentSection")}
      </Text>
    </View>
  );

  const ListFooter = () => {
    if (completedToday.length === 0) return null;

    return (
      <View style={styles.completedSection}>
        <TouchableOpacity
          style={styles.completedHeader}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCompletedExpanded(!completedExpanded);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.completedHeaderLeft}>
            <Feather name="check-circle" size={16} color={STATUS_COLORS.completed} />
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
              {t("myShift.completedToday")}
            </Text>
            <View style={[styles.countBadge, { backgroundColor: STATUS_COLORS.completed + "20" }]}>
              <Text style={[styles.countBadgeText, { color: STATUS_COLORS.completed }]}>
                {completedToday.length}
              </Text>
            </View>
          </View>
          <Feather
            name={completedExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
        {completedExpanded && (
          <View style={styles.completedList}>
            {completedToday.map(renderCompletedCard)}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={activeOrders}
          keyExtractor={(i) => i.id}
          renderItem={renderOrderCard}
          ListHeaderComponent={<ListHeader />}
          ListFooterComponent={<ListFooter />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="coffee" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {t("myShift.noActiveOrders")}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                {t("myShift.noActiveOrdersHint")}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={manualRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 100 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  lastUpdated: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginBottom: 16,
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  completedSection: { marginTop: 20 },
  completedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  completedHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  completedList: { gap: 6, marginTop: 8 },
  completedCard: {
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  completedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  completedDot: { width: 8, height: 8, borderRadius: 4 },
  completedInfo: { flex: 1, gap: 2 },
  completedTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  completedMeta: { flexDirection: "row", gap: 12 },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  locationText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  cacheAgeText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  loader: { marginTop: 60 },
  empty: { alignItems: "center", marginTop: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
