import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useNetwork } from "@/services/network";
import { enqueue } from "@/services/sync-queue";
import { isQueueable } from "@/services/offline-policy";
import { getAccessToken, getCompanyId } from "@/services/api";
import { MediaAttachments } from "@/components/MediaAttachments";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function CreateMaintenanceScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { isConnected } = useNetwork();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maintenanceType, setMaintenanceType] = useState<"preventive" | "corrective" | "inspection">("corrective");
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const types = ["preventive", "corrective", "inspection"] as const;

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t("common.error"), t("maintenance.errorEnterTitle"));
      return;
    }

    const payload = { title: title.trim(), description: description.trim(), type: maintenanceType };

    if (!isConnected && isQueueable("create_maintenance")) {
      await enqueue({
        actionType: "create_maintenance",
        payload,
        endpoint: "/api/maintenance",
        method: "POST",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("maintenance.queued"), t("maintenance.queuedMessage"), [
        { text: t("common.ok"), onPress: () => router.back() },
      ]);
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const companyId = await getCompanyId();
      if (!token || !companyId) throw new Error(t("scanner.notAuthenticated"));

      const res = await fetch(`${BASE_URL}/api/maintenance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("maintenance.failedToCreate"));
      }

      const { data } = await res.json();
      setCreatedId(data.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("maintenance.success"), t("maintenance.successMessage"), [
        { text: t("maintenance.done"), onPress: () => router.back() },
        { text: t("maintenance.addPhotos"), style: "cancel" },
      ]);
    } catch (err: unknown) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("maintenance.failedToCreate"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("maintenance.title")}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder={t("maintenance.maintenanceTitle")}
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("maintenance.description")}</Text>
          <TextInput
            style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder={t("maintenance.describeMaintenance")}
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("maintenance.type")}</Text>
          <View style={styles.typeRow}>
            {types.map((tp) => (
              <TouchableOpacity
                key={tp}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: maintenanceType === tp ? colors.primary : colors.muted,
                    borderColor: maintenanceType === tp ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setMaintenanceType(tp)}
              >
                <Text style={[styles.typeText, { color: maintenanceType === tp ? "#fff" : colors.foreground }]}>
                  {tp}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {createdId && (
          <MediaAttachments entityType="maintenance" entityId={createdId} />
        )}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={loading || !!createdId}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={!isConnected ? "clock" : "check"} size={18} color="#fff" />
              <Text style={styles.submitText}>
                {createdId ? t("maintenance.created") : !isConnected ? t("maintenance.queueForLater") : t("maintenance.createTask")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_400Regular" },
  textArea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 100 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  typeText: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "capitalize" as const },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 8,
  },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
