import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface ClientProfile {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: string;
  rating: number;
  createdAt: string;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const _colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/client/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) setProfile(json.data);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout();
      return;
    }
    Alert.alert(t("settings.signOut"), t("settings.signOutConfirm"), [
      { text: t("settings.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  const displayName =
    profile?.fullName ||
    user?.fullName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 100 },
      ]}
    >
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        {profile?.status && (
          <View
            style={[
              styles.statusBadge,
              profile.status === "active"
                ? styles.statusActive
                : styles.statusInactive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                profile.status === "active"
                  ? styles.statusActiveText
                  : styles.statusInactiveText,
              ]}
            >
              {profile.status}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <InfoRow
          icon="phone"
          label={t("clientProfile.phone")}
          value={profile?.phone || user?.phone || "—"}
        />
        <View style={styles.divider} />
        <InfoRow
          icon="mail"
          label={t("clientProfile.email")}
          value={profile?.email || user?.email || "—"}
        />
        <View style={styles.divider} />
        <InfoRow
          icon="star"
          label={t("clientProfile.rating")}
          value={String(profile?.rating ?? 0)}
        />
        <View style={styles.divider} />
        <InfoRow
          icon="calendar"
          label={t("clientProfile.memberSince")}
          value={
            profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString()
              : "—"
          }
        />
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={18} color="#E53935" />
        <Text style={styles.logoutText}>{t("settings.signOut")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Feather
          name={icon as React.ComponentProps<typeof Feather>["name"]}
          size={18}
          color="#8c8c8c"
        />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
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
  content: { padding: 16, gap: 20 },
  avatarSection: { alignItems: "center", gap: 8, paddingTop: 16 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5C518",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1a1a1a" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  statusActive: { backgroundColor: "#E8F5E9" },
  statusInactive: { backgroundColor: "#FFF3E0" },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statusActiveText: { color: "#2E7D32" },
  statusInactiveText: { color: "#E65100" },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#8c8c8c" },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#1a1a1a",
  },
  divider: { height: 1, backgroundColor: "#f0f0f0" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#FDEDED",
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#E53935",
  },
});
