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
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { useNetwork } from "@/services/network";
import { getPushRegistrationStatus, registerForPushNotifications } from "@/services/push";
import { toggleLanguage } from "../../i18n/i18n";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
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
    if (Platform.OS === "web") {
      logout();
      return;
    }
    Alert.alert(t("settings.signOut"), t("settings.signOutConfirm"), [
      { text: t("settings.cancel"), style: "cancel" },
      { text: t("settings.signOut"), style: "destructive", onPress: () => logout() },
    ]);
  };

  const handleToggleLanguage = () => {
    toggleLanguage();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  type SettingsItem = {
    label: string;
    icon: React.ComponentProps<typeof Feather>["name"];
    detail: string;
    onPress?: () => void;
    color?: string;
  };

  const rows: Array<{ title: string; items: SettingsItem[] }> = [
    {
      title: t("settings.account"),
      items: [
        { label: user?.email ?? "—", icon: "user", detail: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() },
      ],
    },
    {
      title: t("settings.status"),
      items: [
        {
          label: t("settings.network"),
          icon: isConnected ? "wifi" : "wifi-off",
          detail: isConnected ? t("settings.connected") : t("settings.offline"),
          color: isConnected ? colors.success : colors.destructive,
        },
        {
          label: t("settings.pushNotifications"),
          icon: "bell",
          detail: pushStatus.isRegistered ? t("settings.registered") : t("settings.notRegistered"),
          onPress: handlePushToggle,
        },
        {
          label: t("settings.pendingSync"),
          icon: "refresh-cw",
          detail: `${pendingCount} ${pendingCount !== 1 ? t("settings.items") : t("settings.item")}`,
          color: pendingCount > 0 ? colors.warning : colors.mutedForeground,
        },
        {
          label: t("settings.language"),
          icon: "globe",
          detail: i18n.language === "ru" ? "Русский" : "English",
          onPress: handleToggleLanguage,
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
            <View style={[styles.card, { backgroundColor: colors.card }]}>
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
                  <View style={[styles.rowIconWrap, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name={item.icon} size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[styles.rowDetail, { color: item.color ?? colors.mutedForeground }]}>
                    {item.detail}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.destructive + "10" }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>{t("settings.signOut")}</Text>
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
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  rowDetail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 16,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
