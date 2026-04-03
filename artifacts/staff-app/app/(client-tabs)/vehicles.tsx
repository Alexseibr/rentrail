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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
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

const ASSET_TYPE_ICONS: Record<string, string> = {
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

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renting, setRenting] = useState<string | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);

  const fetchVehicles = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/vehicles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId || "",
        },
      });
      const json = await res.json();
      if (json.data) setVehicles(json.data);
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
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

  const handleLookup = async () => {
    const code = searchCode.trim();
    if (!code) return;
    setSearching(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/vehicles/lookup?code=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.data) {
        if (json.data.hasActiveRental) {
          router.push({ pathname: "/(client-tabs)/vehicle-detail", params: { id: json.data.id } });
        } else {
          Alert.alert(t("clientVehicles.vehicleFound"), `${json.data.brand ?? ""} ${json.data.model ?? ""} (${json.data.internalCode})\n${t("clientVehicles.noActiveRentalForVehicle")}`);
        }
        setSearchCode("");
      } else {
        Alert.alert(t("common.error"), json.error?.message || t("clientVehicles.vehicleNotFound"));
      }
    } catch {
      Alert.alert(t("common.error"), t("clientVehicles.lookupFailed"));
    } finally {
      setSearching(false);
    }
  };

  const handleRent = async (vehicleId: string) => {
    Alert.alert(
      t("clientVehicles.confirmRent"),
      t("clientVehicles.confirmRentMessage"),
      [
        { text: t("common.cancel", t("settings.cancel")), style: "cancel" },
        {
          text: t("clientVehicles.rent"),
          onPress: async () => {
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
              const json = await res.json();
              if (res.ok) {
                Alert.alert(t("clientVehicles.success"), t("clientVehicles.rentalStarted"));
                fetchVehicles();
              } else {
                Alert.alert(t("common.error"), json.error?.message || "Failed");
              }
            } catch {
              Alert.alert(t("common.error"), t("clientVehicles.rentFailed"));
            } finally {
              setRenting(null);
            }
          },
        },
      ],
    );
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const typeColor = ASSET_TYPE_COLORS[item.assetType] || "#666";
    const typeIcon = ASSET_TYPE_ICONS[item.assetType] || "circle";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}>
            <Feather name={typeIcon as any} size={16} color={typeColor} />
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
          {item.branchName && (
            <View style={styles.infoItem}>
              <Feather name="map-pin" size={13} color="#8c8c8c" />
              <Text style={styles.infoText}>{item.branchName}</Text>
            </View>
          )}
          {item.batteryPercent != null && (
            <View style={styles.infoItem}>
              <Feather name="battery" size={13} color={item.batteryPercent > 20 ? "#4CAF50" : "#E53935"} />
              <Text style={styles.infoText}>{item.batteryPercent}%</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.rentButton, renting === item.id && { opacity: 0.7 }]}
          onPress={() => handleRent(item.id)}
          disabled={!!renting}
          activeOpacity={0.8}
        >
          {renting === item.id ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <>
              <Feather name="play-circle" size={18} color="#1a1a1a" />
              <Text style={styles.rentButtonText}>{t("clientVehicles.rent")}</Text>
            </>
          )}
        </TouchableOpacity>
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

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <Feather name="search" size={16} color="#8c8c8c" />
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
          style={[styles.searchBtn, searching && { opacity: 0.7 }]}
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
            onRefresh={() => { setRefreshing(true); fetchVehicles(); }}
            tintColor="#F5C518"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="map-pin" size={48} color="#ccc" />
            <Text style={styles.emptyText}>{t("clientVehicles.noVehicles")}</Text>
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
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  vehicleName: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#1a1a1a" },
  infoRow: { flexDirection: "row", gap: 16 },
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
  rentButtonText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  searchBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
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
    backgroundColor: "#F5C518",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#8c8c8c" },
});
