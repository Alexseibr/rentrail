import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSync } from "@/contexts/SyncContext";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";

export default function OperationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { pendingCount } = useSync();

  const sections = [
    {
      title: "Field Actions",
      items: [
        { label: "Scan Asset", icon: "maximize" as const, route: "/scanner" },
        { label: "Report Incident", icon: "alert-circle" as const, route: "/create-incident" },
        { label: "New Maintenance", icon: "tool" as const, route: "/create-maintenance" },
      ],
    },
    {
      title: "Sync & Queue",
      items: [
        {
          label: "Sync Queue",
          icon: "refresh-cw" as const,
          route: "/sync-queue",
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
      ],
    },
    {
      title: "Fleet",
      items: [
        { label: "Notifications", icon: "bell" as const, route: "/notifications" },
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
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(item.route as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name={item.icon} size={20} color={colors.primary} />
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
  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
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
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
