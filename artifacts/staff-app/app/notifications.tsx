import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { getAccessToken, getCompanyId } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
}

async function fetchNotifications(): Promise<Notification[]> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token) return [];

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (companyId) headers["x-company-id"] = companyId;

  const res = await fetch(`${BASE_URL}/api/notifications`, { headers });
  if (!res.ok) return [];
  const { data } = await res.json();
  return data;
}

const TYPE_ICONS: Record<string, string> = {
  inquiry_created: "message-circle",
  rental_started: "play-circle",
  rental_overdue: "alert-triangle",
  payment_paid: "dollar-sign",
  incident_created: "alert-circle",
  maintenance_created: "tool",
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 15000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(`${BASE_URL}/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.readAt;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isUnread ? colors.accent : colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={() => {
          if (isUnread) markRead.mutate(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Feather
            name={(TYPE_ICONS[item.type] ?? "bell") as any}
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: isUnread ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
            {item.title}
          </Text>
          {item.body && (
            <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.body}
            </Text>
          )}
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
        {isUnread && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          scrollEnabled={notifications.length > 0}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bell-off" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("notifications.noNotifications")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 8, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 14 },
  body: { fontSize: 12, fontFamily: "Inter_400Regular" },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
