import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStateFocus } from "@/hooks/useAppStateFocus";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Rental {
  id: string;
  assetId: string | null;
  status: string;
  startAt: string | null;
  plannedEndAt: string | null;
  actualEndAt: string | null;
  assetCode: string | null;
  assetType: string | null;
  assetBrand: string | null;
  assetModel: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; accent: string }
> = {
  active: { bg: "#E8F5E9", text: "#2E7D32", accent: "#4CAF50" },
  overdue: { bg: "#FFEBEE", text: "#C62828", accent: "#E53935" },
  completed: { bg: "#E3F2FD", text: "#1565C0", accent: "#2196F3" },
  canceled: { bg: "#FAFAFA", text: "#757575", accent: "#9E9E9E" },
};

const ASSET_TYPE_ICONS: Record<string, string> = {
  bike: "activity",
  ebike: "zap",
  scooter: "wind",
  escooter: "battery-charging",
};

function useLiveElapsed(startAt: string | null, active: boolean): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!active || !startAt) {
      setElapsed("");
      return;
    }
    const calc = () => {
      const diff = Math.max(
        0,
        Math.floor((Date.now() - new Date(startAt).getTime()) / 1000),
      );
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0)
        setElapsed(
          `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        );
      else setElapsed(`${m}:${String(s).padStart(2, "0")}`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [startAt, active]);

  return elapsed;
}

function ActiveTimer({ startAt }: { startAt: string | null }) {
  const elapsed = useLiveElapsed(startAt, true);
  if (!elapsed) return null;
  return (
    <View style={timerStyles.wrap}>
      <View style={timerStyles.dot} />
      <Text style={timerStyles.text}>{elapsed}</Text>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#2E7D32",
    letterSpacing: 0.5,
  },
});

export default function MyRentalsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRentals = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/rentals`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId || "",
        },
      });
      const json = await res.json();
      if (json.data) setRentals(json.data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      fetchRentals();
      return () => {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setConfirmingId(null);
      };
    }, [fetchRentals]),
  );

  useAppStateFocus(() => {
    fetchRentals();
  });

  const handleReturnPress = async (rentalId: string) => {
    if (confirmingId !== rentalId) {
      setConfirmingId(rentalId);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingId(null), 3000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingId(null);
    setReturning(rentalId);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${BASE_URL}/api/client/rentals/${rentalId}/return`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-company-id": companyId || "",
          },
        },
      );
      if (res.ok) {
        fetchRentals();
        showSnackbar(t("toast.returnSuccess"), "success");
      } else {
        showSnackbar(t("toast.returnFailed"), "error");
      }
    } catch {
      showSnackbar(t("toast.returnFailed"), "error");
    } finally {
      setReturning(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderRental = ({ item }: { item: Rental }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.canceled;
    const isActive = item.status === "active";
    const isOverdue = item.status === "overdue";
    const isLive = isActive || isOverdue;
    const typeIcon = item.assetType
      ? ASSET_TYPE_ICONS[item.assetType] || "circle"
      : "circle";
    const isConfirming = confirmingId === item.id;
    const isReturning = returning === item.id;

    return (
      <View style={[styles.card, isLive && styles.cardActive]}>
        {isLive && (
          <View
            style={[styles.cardAccent, { backgroundColor: statusStyle.accent }]}
          />
        )}

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() =>
            router.push({
              pathname: "/(client-tabs)/rental-detail",
              params: { id: item.id },
            })
          }
        >
          <View style={styles.cardHeader}>
            <View
              style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
            >
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {t(
                  `clientRentals.status_${item.status}`,
                  item.status.toUpperCase(),
                )}
              </Text>
            </View>
            {isLive && <ActiveTimer startAt={item.startAt} />}
            {!isLive && (
              <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
            )}
          </View>

          <View style={styles.vehicleRow}>
            {item.assetType && (
              <View
                style={[styles.vehicleIcon, { backgroundColor: "#F5C51815" }]}
              >
                <Feather
                  name={
                    typeIcon as React.ComponentProps<typeof Feather>["name"]
                  }
                  size={18}
                  color="#F5C518"
                />
              </View>
            )}
            <View style={styles.vehicleInfo}>
              {item.assetBrand ? (
                <Text style={styles.vehicleName}>
                  {item.assetBrand} {item.assetModel}
                </Text>
              ) : (
                <Text style={styles.vehicleName}>
                  {t("clientRentals.vehicle")}
                </Text>
              )}
              {item.assetCode && (
                <Text style={styles.vehicleCode}>{item.assetCode}</Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color="#ccc" />
          </View>

          {item.startAt && (
            <View style={styles.timeRow}>
              <Feather name="play-circle" size={13} color="#8c8c8c" />
              <Text style={styles.timeLabel}>
                {t("clientRentals.started")}:
              </Text>
              <Text style={styles.timeValue}>{formatDate(item.startAt)}</Text>
            </View>
          )}
          {item.actualEndAt && (
            <View style={styles.timeRow}>
              <Feather name="check-circle" size={13} color="#8c8c8c" />
              <Text style={styles.timeLabel}>{t("clientRentals.ended")}:</Text>
              <Text style={styles.timeValue}>
                {formatDate(item.actualEndAt)}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {isLive && (
          <TouchableOpacity
            style={[
              styles.returnButton,
              isConfirming && styles.returnButtonConfirm,
              isReturning && { opacity: 0.6 },
            ]}
            onPress={() => handleReturnPress(item.id)}
            disabled={!!returning}
            activeOpacity={0.8}
          >
            {isReturning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : isConfirming ? (
              <>
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.returnButtonText}>
                  {t("clientRentals.confirmReturn")}
                </Text>
              </>
            ) : (
              <>
                <Feather name="corner-down-left" size={16} color="#fff" />
                <Text style={styles.returnButtonText}>
                  {t("clientRentals.returnVehicle")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  const activeRentals = rentals.filter(
    (r) => r.status === "active" || r.status === "overdue",
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={rentals}
        keyExtractor={(r) => r.id}
        renderItem={renderRental}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRentals();
            }}
            tintColor="#F5C518"
          />
        }
        ListHeaderComponent={
          activeRentals.length > 0 ? (
            <Text style={styles.sectionLabel}>{t("clientRentals.active")}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Feather name="clock" size={36} color="#F5C518" />
            </View>
            <Text style={styles.emptyTitle}>
              {t("clientRentals.noRentals")}
            </Text>
            <Text style={styles.emptyHint}>{t("clientRentals.goRent")}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  list: { padding: 16, gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#8c8c8c",
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  dateText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#8c8c8c" },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  vehicleInfo: { flex: 1 },
  vehicleName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#1a1a1a",
  },
  vehicleCode: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#8c8c8c",
    marginTop: 1,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#8c8c8c" },
  timeValue: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#555" },
  returnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E53935",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 2,
  },
  returnButtonConfirm: {
    backgroundColor: "#F5C518",
  },
  returnButtonText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#F5C51815",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#1a1a1a",
  },
  emptyHint: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#8c8c8c" },
});
