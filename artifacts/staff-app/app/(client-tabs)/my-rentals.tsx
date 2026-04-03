import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#E8F5E9", text: "#2E7D32" },
  overdue: { bg: "#FFF3E0", text: "#E65100" },
  completed: { bg: "#E3F2FD", text: "#1565C0" },
  canceled: { bg: "#FAFAFA", text: "#757575" },
};

export default function MyRentalsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const router = useRouter();

  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);

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
    } catch (err) {
      console.error("Failed to fetch rentals:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      fetchRentals();
    }, [fetchRentals]),
  );

  const handleReturn = async (rentalId: string) => {
    Alert.alert(
      t("clientRentals.confirmReturn"),
      t("clientRentals.confirmReturnMessage"),
      [
        { text: t("settings.cancel"), style: "cancel" },
        {
          text: t("clientRentals.returnVehicle"),
          onPress: async () => {
            setReturning(rentalId);
            try {
              const token = await getAccessToken();
              const res = await fetch(`${BASE_URL}/api/client/rentals/${rentalId}/return`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                  "x-company-id": companyId || "",
                },
              });
              if (res.ok) {
                Alert.alert(t("clientRentals.success"), t("clientRentals.returnCompleted"));
                fetchRentals();
              } else {
                const json = await res.json();
                Alert.alert(t("common.error"), json.error?.message || "Failed");
              }
            } catch {
              Alert.alert(t("common.error"), t("clientRentals.returnFailed"));
            } finally {
              setReturning(null);
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const renderRental = ({ item }: { item: Rental }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.canceled;
    const isActive = item.status === "active" || item.status === "overdue";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: "/(client-tabs)/rental-detail", params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {t(`clientRentals.status_${item.status}`, item.status.toUpperCase())}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {item.assetBrand && (
          <Text style={styles.vehicleName}>
            {item.assetBrand} {item.assetModel}
          </Text>
        )}

        <View style={styles.infoRow}>
          {item.assetCode && (
            <View style={styles.infoItem}>
              <Feather name="tag" size={13} color="#8c8c8c" />
              <Text style={styles.infoText}>{item.assetCode}</Text>
            </View>
          )}
        </View>

        {item.startAt && (
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{t("clientRentals.started")}:</Text>
            <Text style={styles.timeValue}>{formatDate(item.startAt)}</Text>
          </View>
        )}
        {item.actualEndAt && (
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{t("clientRentals.ended")}:</Text>
            <Text style={styles.timeValue}>{formatDate(item.actualEndAt)}</Text>
          </View>
        )}

        {isActive && (
          <TouchableOpacity
            style={[styles.returnButton, returning === item.id && { opacity: 0.7 }]}
            onPress={() => handleReturn(item.id)}
            disabled={!!returning}
            activeOpacity={0.8}
          >
            {returning === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="corner-down-left" size={18} color="#fff" />
                <Text style={styles.returnButtonText}>{t("clientRentals.returnVehicle")}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rentals}
        keyExtractor={(r) => r.id}
        renderItem={renderRental}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRentals(); }}
            tintColor="#F5C518"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="clock" size={48} color="#ccc" />
            <Text style={styles.emptyText}>{t("clientRentals.noRentals")}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  dateText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#8c8c8c" },
  vehicleName: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#1a1a1a" },
  infoRow: { flexDirection: "row", gap: 16 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8c8c8c" },
  timeRow: { flexDirection: "row", gap: 6 },
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
    marginTop: 4,
  },
  returnButtonText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#8c8c8c" },
});
