import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { getAccessToken, getCompanyId } from "@/services/api";
import { MediaAttachments } from "@/components/MediaAttachments";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function fetchRental(id: string) {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  if (!token || !companyId) return null;

  const res = await fetch(`${BASE_URL}/api/rentals/${id}`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

export default function RentalDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [returnNotes, setReturnNotes] = useState("");
  const [showReturn, setShowReturn] = useState(false);

  const { data: rental, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: () => fetchRental(id!),
    enabled: !!id,
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const companyId = await getCompanyId();
      if (!token || !companyId) throw new Error("Not authenticated");

      const res = await fetch(`${BASE_URL}/api/rentals/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({ status: "completed", notes: returnNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to complete return");
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["rental", id] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      setShowReturn(false);
      Alert.alert("Success", "Rental return completed");
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message);
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!rental) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Rental not found</Text>
      </View>
    );
  }

  const fields = [
    { label: "Status", value: rental.status },
    { label: "Type", value: rental.rentalType },
    { label: "Created", value: new Date(rental.createdAt).toLocaleDateString() },
  ].filter((f) => f.value);

  const canReturn = ["active", "overdue", "extended"].includes(rental.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.statusBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.statusText, { color: colors.primary }]}>
              {rental.status.replace(/_/g, " ")}
            </Text>
          </View>
          <Text style={[styles.rentalTitle, { color: colors.foreground }]}>
            {rental.rentalType} Rental
          </Text>
        </View>

        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {fields.map((f) => (
            <View key={f.label} style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
              <Text style={[styles.fieldValue, { color: colors.foreground }]}>{f.value}</Text>
            </View>
          ))}
        </View>

        {canReturn && (
          <View style={styles.returnSection}>
            {!showReturn ? (
              <TouchableOpacity
                style={[styles.returnBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowReturn(true)}
                activeOpacity={0.8}
              >
                <Feather name="log-in" size={18} color="#fff" />
                <Text style={styles.returnBtnText}>Process Return</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.returnForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.returnTitle, { color: colors.foreground }]}>Return Vehicle</Text>

                <MediaAttachments entityType="rental" entityId={id!} />

                <TextInput
                  style={[styles.notesInput, { borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Return notes (optional)..."
                  placeholderTextColor={colors.mutedForeground}
                  value={returnNotes}
                  onChangeText={setReturnNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <View style={styles.returnActions}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.border }]}
                    onPress={() => setShowReturn(false)}
                  >
                    <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                    onPress={() => returnMutation.mutate()}
                    disabled={returnMutation.isPending}
                  >
                    {returnMutation.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.confirmText}>Complete Return</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  headerCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 6 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  rentalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textTransform: "capitalize" as const },
  detailCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  returnSection: {},
  returnBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  returnBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  returnForm: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 16 },
  returnTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  notesInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80 },
  returnActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
