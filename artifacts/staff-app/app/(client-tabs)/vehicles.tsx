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
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStateFocus } from "@/hooks/useAppStateFocus";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Vehicle {
  id: string;
  assetType: string;
  brand: string;
  model: string;
  internalCode: string;
  status: string;
  branchName: string | null;
  lat: number | null;
  lng: number | null;
  batteryPercent: number | null;
}

const ASSET_TYPE_ICONS: Record<
  string,
  React.ComponentProps<typeof Feather>["name"]
> = {
  bike: "activity",
  ebike: "zap",
  scooter: "wind",
  escooter: "battery-charging",
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  bike: "#4CAF50",
  ebike: "#2196F3",
  scooter: "#FF9800",
  escooter: "#9C27B0",
};

const VEHICLE_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  available: { color: "#2E7D32", bg: "#4CAF5020" },
  reserved: { color: "#1565C0", bg: "#2196F320" },
  maintenance: { color: "#E65100", bg: "#FF980020" },
};

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renting, setRenting] = useState<string | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);

  const [confirmVehicle, setConfirmVehicle] = useState<Vehicle | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/vehicles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId || "",
        },
      });
      const json = (await res.json()) as { data?: Vehicle[] };
      if (json.data) setVehicles(json.data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      fetchVehicles();
    }, [fetchVehicles]),
  );

  useAppStateFocus(() => {
    fetchVehicles();
  });

  const handleLookup = async () => {
    const code = searchCode.trim();
    if (!code) return;
    setSearching(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${BASE_URL}/api/client/vehicles/lookup?code=${encodeURIComponent(code)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-company-id": companyId || "",
          },
        },
      );
      const json = (await res.json()) as {
        data?: { id: string };
        error?: { message?: string };
      };
      if (res.ok && json.data) {
        setSearchCode("");
        router.push({
          pathname: "/(client-tabs)/vehicle-detail",
          params: { id: json.data.id },
        });
      } else {
        Alert.alert(
          t("common.error"),
          json.error?.message || t("clientVehicles.vehicleNotFound"),
        );
      }
    } catch {
      Alert.alert(t("common.error"), t("clientVehicles.lookupFailed"));
    } finally {
      setSearching(false);
    }
  };

  const confirmRent = async (vehicleId: string) => {
    setConfirmVehicle(null);
    setRenting(vehicleId);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/rentals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-company-id": companyId || "",
        },
        body: JSON.stringify({ assetId: vehicleId }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (res.ok) {
        Alert.alert(
          t("clientVehicles.success"),
          t("clientVehicles.rentalStarted"),
        );
        fetchVehicles();
      } else {
        Alert.alert(t("common.error"), json.error?.message ?? "Failed");
      }
    } catch {
      Alert.alert(t("common.error"), t("clientVehicles.rentFailed"));
    } finally {
      setRenting(null);
    }
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const typeColor = ASSET_TYPE_COLORS[item.assetType] || "#666";
    const typeIcon = ASSET_TYPE_ICONS[item.assetType] || "circle";
    const statusStyle =
      VEHICLE_STATUS_STYLE[item.status] || VEHICLE_STATUS_STYLE.available;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/(client-tabs)/vehicle-detail",
            params: { id: item.id },
          })
        }
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <View
            style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}
          >
            <Feather
              name={typeIcon as React.ComponentProps<typeof Feather>["name"]}
              size={15}
              color={typeColor}
            />
            <Text style={[styles.typeText, { color: typeColor }]}>
              {item.assetType.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.codeText}>{item.internalCode}</Text>
        </View>

        <Text style={styles.vehicleName}>
          {item.brand} {item.model}
        </Text>

        <View style={styles.infoRow}>
          <View
            style={[styles.availBadge, { backgroundColor: statusStyle.bg }]}
          >
            <View
              style={[styles.availDot, { backgroundColor: statusStyle.color }]}
            />
            <Text style={[styles.availText, { color: statusStyle.color }]}>
              {String(t(`clientVehicles.status_${item.status}`, item.status))}
            </Text>
          </View>
          {item.branchName && (
            <View style={styles.infoItem}>
              <Feather name="map-pin" size={13} color="#8c8c8c" />
              <Text style={styles.infoText}>{item.branchName}</Text>
            </View>
          )}
          {item.batteryPercent != null && (
            <View style={styles.infoItem}>
              <Feather
                name="battery"
                size={13}
                color={item.batteryPercent > 20 ? "#4CAF50" : "#E53935"}
              />
              <Text style={styles.infoText}>{item.batteryPercent}%</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.rentButton, renting === item.id && { opacity: 0.7 }]}
          onPress={(e) => {
            e.stopPropagation?.();
            setConfirmVehicle(item);
          }}
          disabled={!!renting}
          activeOpacity={0.8}
        >
          {renting === item.id ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <>
              <Feather name="play-circle" size={17} color="#1a1a1a" />
              <Text style={styles.rentButtonText}>
                {t("clientVehicles.rent")}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
      <View style={styles.searchBar}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push("/client-scanner")}
          activeOpacity={0.7}
        >
          <Feather name="maximize" size={20} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.searchInputWrap}>
          <Feather name="search" size={15} color="#8c8c8c" />
          <TextInput
            style={styles.searchInput}
            placeholder={t("clientVehicles.enterCode")}
            placeholderTextColor="#aaa"
            value={searchCode}
            onChangeText={setSearchCode}
            onSubmitEditing={handleLookup}
            returnKeyType="search"
            autoCapitalize="characters"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.searchBtn,
            (searching || !searchCode.trim()) && { opacity: 0.5 },
          ]}
          onPress={handleLookup}
          disabled={searching || !searchCode.trim()}
          activeOpacity={0.7}
        >
          {searching ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <Feather name="arrow-right" size={18} color="#1a1a1a" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        renderItem={renderVehicle}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchVehicles();
            }}
            tintColor="#F5C518"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Feather name="map-pin" size={36} color="#F5C518" />
            </View>
            <Text style={styles.emptyTitle}>
              {t("clientVehicles.noVehicles")}
            </Text>
            <Text style={styles.emptyHint}>
              {t("clientVehicles.tryScanning")}
            </Text>
          </View>
        }
      />

      <Modal
        visible={!!confirmVehicle}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVehicle(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setConfirmVehicle(null)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Feather name="play-circle" size={32} color="#F5C518" />
            </View>
            <Text style={styles.modalTitle}>
              {t("clientVehicles.confirmRent")}
            </Text>
            {confirmVehicle && (
              <Text style={styles.modalVehicleName}>
                {confirmVehicle.brand} {confirmVehicle.model}
              </Text>
            )}
            <Text style={styles.modalMessage}>
              {t("clientVehicles.confirmRentMessage")}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setConfirmVehicle(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => confirmVehicle && confirmRent(confirmVehicle.id)}
                activeOpacity={0.8}
              >
                <Feather name="play-circle" size={17} color="#1a1a1a" />
                <Text style={styles.modalConfirmText}>
                  {t("clientVehicles.rent")}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  list: { padding: 16, gap: 12 },
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
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  codeText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#8c8c8c" },
  vehicleName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#1a1a1a",
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  availBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8c8c8c" },
  rentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F5C518",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  rentButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
  },
  searchBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5C518",
    justifyContent: "center",
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#1a1a1a",
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
    alignItems: "center",
    gap: 12,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F5C51820",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
    textAlign: "center",
  },
  modalVehicleName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#8c8c8c",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
  },
  modalConfirm: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F5C518",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalConfirmText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
  },
});
