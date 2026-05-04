import React from "react";
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
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useSync } from "@/contexts/SyncContext";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { useAuth } from "@/contexts/AuthContext";

export default function OperationsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { pendingCount } = useSync();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      logout();
      return;
    }
    Alert.alert(t("settings.signOut"), t("settings.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.signOut"), style: "destructive", onPress: () => logout() },
    ]);
  };

  type OperationItem = {
    label: string;
    icon: React.ComponentProps<typeof Feather>["name"];
    route: string;
    badge?: number;
    color?: string;
  };

  type OperationSection = { title: string; items: OperationItem[] };

  const sections: OperationSection[] = [
    {
      title: t("operations.fieldActions"),
      items: [
        { label: t("operations.scanAsset"), icon: "maximize", route: "/scanner" },
        { label: t("operations.reportIncident"), icon: "alert-circle", route: "/create-incident" },
        { label: t("operations.newMaintenance"), icon: "tool", route: "/create-maintenance" },
        { label: t("operations.notifications"), icon: "bell", route: "/notifications" },
      ],
    },
    {
      title: t("serviceModule.serviceSection"),
      items: [
        { label: t("serviceModule.workOrders"), icon: "clipboard", route: "/service/work-orders", color: "#3b82f6" },
        { label: t("incidents.listTitle"), icon: "alert-circle", route: "/incidents", color: "#ef4444" },
        { label: t("serviceModule.spareParts"), icon: "package", route: "/service/spare-parts", color: "#f59e0b" },
        { label: t("maintenance.listTitle"), icon: "tool", route: "/maintenance", color: "#8b5cf6" },
        { label: t("serviceModule.schedules"), icon: "calendar", route: "/service/schedules", color: "#22c55e" },
      ],
    },
    {
      title: t("operations.syncAndQueue"),
      items: [
        {
          label: t("operations.syncQueue"),
          icon: "refresh-cw",
          route: "/sync-queue",
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SyncStatusBanner />
      <ScrollView contentContainerStyle={styles.scroll}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(item.route as Parameters<typeof router.push>[0]);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIconWrap, { backgroundColor: (item.color ?? colors.primary) + "18" }]}>
                    <Feather name={item.icon} size={18} color={item.color ?? colors.primary} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.label}</Text>
                  {item.badge ? (
                    <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("settings.account")}
          </Text>
          {user && (
            <Text style={[styles.userInfo, { color: colors.mutedForeground }]}>
              {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.phone}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: "#DC262610" }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Feather name="log-out" size={18} color="#DC2626" />
            <Text style={styles.logoutText}>{t("settings.signOut")}</Text>
          </TouchableOpacity>
        </View>
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
  sectionCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  userInfo: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 10,
    marginLeft: 4,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#DC2626",
  },
});
