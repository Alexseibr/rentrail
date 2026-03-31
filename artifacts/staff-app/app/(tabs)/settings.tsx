import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { useNetwork } from "@/services/network";
import { getPushRegistrationStatus, registerForPushNotifications } from "@/services/push";

export default function SettingsScreen() {
  const colors = useColors();
  const { user, logout, companyId } = useAuth();
  const { pendingCount } = useSync();
  const { isConnected } = useNetwork();
  const [pushStatus, setPushStatus] = useState({ hasToken: false, isRegistered: false });

  useEffect(() => {
    getPushRegistrationStatus().then((s) => setPushStatus({ hasToken: s.hasToken, isRegistered: s.isRegistered }));
  }, []);

  const handlePushToggle = async () => {
    if (pushStatus.isRegistered) return;
    const token = await registerForPushNotifications();
    if (token) {
      setPushStatus({ hasToken: true, isRegistered: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const rows = [
    {
      title: "Account",
      items: [
        { label: user?.email ?? "—", icon: "user" as const, detail: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() },
      ],
    },
    {
      title: "Status",
      items: [
        {
          label: "Network",
          icon: (isConnected ? "wifi" : "wifi-off") as "wifi" | "wifi-off",
          detail: isConnected ? "Connected" : "Offline",
          color: isConnected ? colors.success : colors.destructive,
        },
        {
          label: "Push Notifications",
          icon: "bell" as const,
          detail: pushStatus.isRegistered ? "Registered" : "Not registered",
          onPress: handlePushToggle,
        },
        {
          label: "Pending Sync",
          icon: "refresh-cw" as const,
          detail: `${pendingCount} item${pendingCount !== 1 ? "s" : ""}`,
          color: pendingCount > 0 ? colors.warning : colors.mutedForeground,
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {rows.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {section.title}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={item.onPress}
                  disabled={!item.onPress}
                  activeOpacity={item.onPress ? 0.7 : 1}
                >
                  <Feather name={item.icon} size={18} color={colors.primary} />
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[styles.rowDetail, { color: (item as any).color ?? colors.mutedForeground }]}>
                    {item.detail}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.destructive }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  rowDetail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
