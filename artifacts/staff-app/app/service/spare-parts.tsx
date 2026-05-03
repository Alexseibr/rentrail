import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const YELLOW = "#F5C518";

async function fetchParts(companyId: string, lowStock?: boolean) {
  const token = await getAccessToken();
  const url = `${BASE_URL}/api/spare-parts${lowStock ? "?lowStock=true" : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  const json = await res.json();
  return json.data as any[];
}

async function createTransaction(companyId: string, data: object) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/spare-parts/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const j = await res.json();
    throw new Error(j.error?.message ?? "Failed");
  }
  return (await res.json()).data;
}

export default function SparePartsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();

  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [txModal, setTxModal] = useState<{ part: any; type: "in" | "out" | "adjustment" } | null>(null);
  const [qty, setQty] = useState("1");
  const [txNote, setTxNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await fetchParts(companyId, lowStockOnly);
      setParts(data);
    } catch {
      setParts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, lowStockOnly]);

  React.useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = search.trim()
    ? parts.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()),
      )
    : parts;

  const handleTransaction = async () => {
    if (!txModal || !companyId) return;
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0) {
      Alert.alert(t("common.error"), t("serviceModule.invalidQty"));
      return;
    }
    setSubmitting(true);
    try {
      await createTransaction(companyId, {
        partId: txModal.part.id,
        transactionType: txModal.type,
        qty: q,
        notes: txNote.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTxModal(null);
      setQty("1");
      setTxNote("");
      load();
    } catch (e: any) {
      Alert.alert(t("common.error"), e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isLow = (p: any) => parseFloat(p.qtyInStock) <= parseFloat(p.minQtyAlert);

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.partName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
          {item.sku && <Text style={[styles.partSku, { color: colors.mutedForeground }]}>SKU: {item.sku}</Text>}
        </View>
        <View style={styles.stockBlock}>
          <Text style={[styles.stockQty, { color: isLow(item) ? "#ef4444" : "#22c55e" }]}>
            {parseFloat(item.qtyInStock).toLocaleString("ru-RU")}
          </Text>
          <Text style={[styles.stockUnit, { color: colors.mutedForeground }]}>{item.unit}</Text>
          {isLow(item) && <Feather name="alert-triangle" size={12} color="#ef4444" />}
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {t(`serviceModule.cat_${item.category}`, { defaultValue: item.category })}
        </Text>
        {item.costPrice && (
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {parseFloat(item.costPrice).toLocaleString("ru-RU")} ₽/шт
          </Text>
        )}
        {item.location && (
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>📍 {item.location}</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#22c55e18" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTxModal({ part: item, type: "in" }); setQty("1"); setTxNote(""); }}
        >
          <Feather name="plus" size={14} color="#22c55e" />
          <Text style={[styles.actionText, { color: "#22c55e" }]}>{t("serviceModule.receive")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#ef444418" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTxModal({ part: item, type: "out" }); setQty("1"); setTxNote(""); }}
        >
          <Feather name="minus" size={14} color="#ef4444" />
          <Text style={[styles.actionText, { color: "#ef4444" }]}>{t("serviceModule.issue")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary + "18" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTxModal({ part: item, type: "adjustment" }); setQty(item.qtyInStock); setTxNote(""); }}
        >
          <Feather name="edit-2" size={14} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>{t("serviceModule.adjust")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.dark }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("serviceModule.spareParts")}</Text>
        <TouchableOpacity
          onPress={() => setLowStockOnly(v => !v)}
          style={[styles.filterBtn, lowStockOnly && { backgroundColor: YELLOW + "30" }]}
        >
          <Feather name="alert-triangle" size={18} color={lowStockOnly ? YELLOW : "#ffffff80"} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t("serviceModule.searchParts")}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <Feather name="package" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("serviceModule.noParts")}</Text>
            </View>
          )
        }
        contentContainerStyle={styles.list}
      />

      <Modal visible={!!txModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {txModal?.type === "in" ? t("serviceModule.receiveTitle") :
               txModal?.type === "out" ? t("serviceModule.issueTitle") :
               t("serviceModule.adjustTitle")}
            </Text>
            <Text style={[styles.modalPart, { color: colors.mutedForeground }]}>{txModal?.part?.name}</Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("serviceModule.qty")}</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border }]}
              keyboardType="decimal-pad"
              value={qty}
              onChangeText={setQty}
              selectTextOnFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("serviceModule.notes")}</Text>
            <TextInput
              style={[styles.fieldInput, styles.notesInput, { color: colors.foreground, borderColor: colors.border }]}
              value={txNote}
              onChangeText={setTxNote}
              placeholder={t("serviceModule.notesPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.background }]}
                onPress={() => setTxModal(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: YELLOW }]}
                onPress={handleTransaction}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#000" size="small" /> : (
                  <Text style={[styles.modalBtnText, { color: "#000" }]}>{t("common.confirm")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff" },
  filterBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 10 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  list: { padding: 12, paddingBottom: 60 },
  card: { borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  partName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  partSku: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  stockBlock: { alignItems: "flex-end", flexDirection: "row", gap: 4 },
  stockQty: { fontSize: 22, fontFamily: "Inter_700Bold" },
  stockUnit: { fontSize: 12, fontFamily: "Inter_400Regular", paddingBottom: 4 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 10 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  loader: { marginTop: 60 },
  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000060" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 8 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  modalPart: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_400Regular", marginBottom: 8 },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
