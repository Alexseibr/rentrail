import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { getAccessToken } from "@/services/api";
import { useNetwork } from "@/services/network";
import { enqueue } from "@/services/sync-queue";
import { isQueueable } from "@/services/offline-policy";
import { useSync } from "@/contexts/SyncContext";
import { MediaAttachments, type ExistingAttachment } from "@/components/MediaAttachments";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const YELLOW = "#F5C518";

const SEVERITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  assigned: "#8b5cf6",
  in_progress: "#f59e0b",
  on_hold: "#f97316",
  completed: "#22c55e",
  canceled: "#94a3b8",
};

const STATUS_FLOW: Record<string, string | null> = {
  new: "assigned",
  assigned: "in_progress",
  in_progress: "completed",
  on_hold: "in_progress",
  completed: null,
  canceled: null,
};

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

interface IncidentDetail {
  id: string;
  requestType: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  assetId: string | null;
  assetCode: string | null;
  assetType: string | null;
  branchName: string | null;
  branchCity: string | null;
  assignedToName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}


async function fetchIncident(companyId: string, id: string): Promise<IncidentDetail> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/service-requests/${id}`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Not found");
  return (await res.json()).data as IncidentDetail;
}

async function fetchAttachments(companyId: string, id: string): Promise<ExistingAttachment[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `${BASE_URL}/api/attachments?entityType=incident&entityId=${id}`,
    { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as ExistingAttachment[];
}

async function updateStatus(companyId: string, id: string, status: string): Promise<IncidentDetail> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/service-requests/${id}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-company-id": companyId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return (await res.json()).data as IncidentDetail;
}

async function patchIncident(
  companyId: string,
  id: string,
  payload: { title: string; description: string; priority: Priority },
): Promise<IncidentDetail> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/service-requests/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-company-id": companyId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save changes");
  return (await res.json()).data as IncidentDetail;
}

export default function IncidentDetailScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { isConnected } = useNetwork();
  const { queueItems } = useSync();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [attachments, setAttachments] = useState<ExistingAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !id) return;
    try {
      const [data, atts, token] = await Promise.all([
        fetchIncident(companyId, id),
        fetchAttachments(companyId, id),
        getAccessToken(),
      ]);
      setIncident(data);
      setAttachments(atts);
      setAuthToken(token);
    } catch {
      setIncident(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const openEdit = () => {
    if (!incident) return;
    setEditTitle(incident.title);
    setEditDescription(incident.description ?? "");
    setEditPriority((incident.priority as Priority) ?? "medium");
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!companyId || !incident) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      showSnackbar(t("incidentDetail.editTitleRequired"), "error");
      return;
    }
    const payload = {
      title: trimmedTitle,
      description: editDescription.trim(),
      priority: editPriority,
    };

    if (!isConnected && isQueueable("edit_incident")) {
      await enqueue({
        actionType: "edit_incident",
        payload,
        endpoint: `/api/service-requests/${incident.id}`,
        method: "PATCH",
      });
      setIncident((prev) => prev ? { ...prev, ...payload } : prev);
      setEditVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSnackbar(t("incidentDetail.editQueued"), "success");
      return;
    }

    setEditSaving(true);
    try {
      const updated = await patchIncident(companyId, incident.id, payload);
      setIncident(updated);
      setEditVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSnackbar(t("incidentDetail.editSaved"), "success");
    } catch (err: unknown) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error && /network|fetch|failed to fetch/i.test(err.message));

      if (isNetworkError && isQueueable("edit_incident")) {
        await enqueue({
          actionType: "edit_incident",
          payload,
          endpoint: `/api/service-requests/${incident.id}`,
          method: "PATCH",
        });
        setIncident((prev) => (prev ? { ...prev, ...payload } : prev));
        setEditVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSnackbar(t("incidentDetail.editQueued"), "success");
      } else {
        const msg = err instanceof Error ? err.message : t("toast.actionFailed");
        showSnackbar(msg, "error");
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!companyId || !incident) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      t("incidentDetail.updateStatus"),
      t("incidentDetail.updateStatusConfirm", {
        status: t(`incidents.status_${newStatus}`, { defaultValue: newStatus }),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          onPress: async () => {
            if (!isConnected && isQueueable("change_incident_status")) {
              try {
                await enqueue({
                  actionType: "change_incident_status",
                  payload: { status: newStatus },
                  endpoint: `/api/service-requests/${incident.id}/status`,
                  method: "POST",
                });
                setIncident((prev) => prev ? { ...prev, status: newStatus } : prev);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showSnackbar(t("incidentDetail.statusQueued"), "success");
              } catch {
                showSnackbar(t("toast.actionFailed"), "error");
              }
              return;
            }

            setActionLoading(true);
            try {
              const updated = await updateStatus(companyId, incident.id, newStatus);
              setIncident(updated);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSnackbar(t("toast.statusChanged"), "success");
            } catch (err: unknown) {
              const isNetworkError =
                err instanceof TypeError ||
                (err instanceof Error && /network|fetch|failed to fetch/i.test(err.message));

              if (isNetworkError && isQueueable("change_incident_status")) {
                try {
                  await enqueue({
                    actionType: "change_incident_status",
                    payload: { status: newStatus },
                    endpoint: `/api/service-requests/${incident.id}/status`,
                    method: "POST",
                  });
                  setIncident((prev) => prev ? { ...prev, status: newStatus } : prev);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showSnackbar(t("incidentDetail.statusQueued"), "success");
                } catch {
                  showSnackbar(t("toast.actionFailed"), "error");
                }
              } else {
                const msg = err instanceof Error ? err.message : t("toast.actionFailed");
                showSnackbar(msg, "error");
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
          {t("incidentDetail.notFound")}
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 12, fontFamily: "Inter_600SemiBold" }}>
            {t("common.back")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasPendingEdit = queueItems.some(
    (item) =>
      item.actionType === "edit_incident" &&
      item.endpoint === `/api/service-requests/${id}` &&
      (item.status === "queued" || item.status === "syncing" || item.status === "failed"),
  );

  const priorityColor = SEVERITY_COLORS[incident.priority] ?? "#94a3b8";
  const statusColor = STATUS_COLORS[incident.status] ?? "#94a3b8";
  const nextStatus = STATUS_FLOW[incident.status] ?? null;

  const statusHistory = buildStatusHistory(incident);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.dark }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{incident.title}</Text>
        <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
          <Feather name="edit-2" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {hasPendingEdit ? (
        <View style={styles.pendingBanner}>
          <Feather name="clock" size={14} color="#92400e" />
          <Text style={styles.pendingBannerText}>{t("incidentDetail.pendingSyncBanner")}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.statusCard, { backgroundColor: statusColor + "18", borderColor: statusColor + "40" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {t(`incidents.status_${incident.status}`, { defaultValue: incident.status })}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor + "20" }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {t(`incidentDetail.priority_${incident.priority}`, { defaultValue: incident.priority })}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Row
            label={t("incidentDetail.type")}
            value={t(`incidents.type_${incident.requestType}`, { defaultValue: incident.requestType })}
            colors={colors}
          />
          <Row
            label={t("incidentDetail.priority")}
            value={t(`incidentDetail.priority_${incident.priority}`, { defaultValue: incident.priority })}
            colors={colors}
          />
          {incident.assetCode ? (
            <Row
              label={t("incidentDetail.asset")}
              value={`${incident.assetCode}${incident.assetType ? ` · ${incident.assetType}` : ""}`}
              colors={colors}
            />
          ) : null}
          {incident.branchName ? (
            <Row
              label={t("incidentDetail.branch")}
              value={`${incident.branchName}${incident.branchCity ? `, ${incident.branchCity}` : ""}`}
              colors={colors}
            />
          ) : null}
          {incident.assignedToName?.trim() ? (
            <Row label={t("incidentDetail.assignedTo")} value={incident.assignedToName} colors={colors} />
          ) : null}
          {incident.locationAddress ? (
            <Row label={t("incidentDetail.location")} value={incident.locationAddress} colors={colors} />
          ) : null}
        </View>

        {incident.description ? (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("incidentDetail.description")}
            </Text>
            <Text style={[styles.descText, { color: colors.foreground }]}>{incident.description}</Text>
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("incidentDetail.statusHistory")}
          </Text>
          {statusHistory.map((entry, idx) => (
            <View key={idx} style={styles.historyRow}>
              <View style={[styles.historyDot, { backgroundColor: STATUS_COLORS[entry.status] ?? "#94a3b8" }]} />
              <View style={styles.historyContent}>
                <Text style={[styles.historyStatus, { color: colors.foreground }]}>
                  {t(`incidents.status_${entry.status}`, { defaultValue: entry.status })}
                </Text>
                <Text style={[styles.historyTime, { color: colors.mutedForeground }]}>
                  {new Date(entry.at).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <MediaAttachments
            entityType="incident"
            entityId={id!}
            existingAttachments={attachments}
            authToken={authToken}
            onAttachmentCreated={async () => {
              if (!companyId || !id) return;
              const atts = await fetchAttachments(companyId, id);
              setAttachments(atts);
            }}
          />
        </View>

        {nextStatus ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: YELLOW }]}
            onPress={() => handleStatusChange(nextStatus)}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="arrow-right-circle" size={20} color="#000" />
                <Text style={styles.actionBtnText}>
                  {t(`incidentDetail.moveTo_${nextStatus}`, {
                    defaultValue: t(`incidents.status_${nextStatus}`, { defaultValue: nextStatus }),
                  })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {t("incidentDetail.editTitle")}
              </Text>
              <TouchableOpacity onPress={() => setEditVisible(false)} disabled={editSaving}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {t("incidentDetail.fieldTitle")}
            </Text>
            <TextInput
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder={t("incidentDetail.fieldTitlePlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              maxLength={200}
              editable={!editSaving}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {t("incidentDetail.fieldDescription")}
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder={t("incidentDetail.fieldDescriptionPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!editSaving}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {t("incidentDetail.fieldPriority")}
            </Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => {
                const pColor = SEVERITY_COLORS[p];
                const selected = editPriority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityChip,
                      {
                        backgroundColor: selected ? pColor : pColor + "18",
                        borderColor: pColor,
                        borderWidth: selected ? 0 : 1,
                      },
                    ]}
                    onPress={() => setEditPriority(p)}
                    disabled={editSaving}
                  >
                    <Text style={[styles.priorityChipText, { color: selected ? "#fff" : pColor }]}>
                      {t(`incidentDetail.priority_${p}`, { defaultValue: p })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: YELLOW, opacity: editSaving ? 0.6 : 1 }]}
              onPress={handleSaveEdit}
              disabled={editSaving}
              activeOpacity={0.8}
            >
              {editSaving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveBtnText}>{t("incidentDetail.saveChanges")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function buildStatusHistory(incident: IncidentDetail): Array<{ status: string; at: string }> {
  const history: Array<{ status: string; at: string }> = [
    { status: "new", at: incident.createdAt },
  ];
  if (incident.status === "assigned") {
    history.push({ status: "assigned", at: incident.updatedAt });
  } else if (incident.status === "in_progress") {
    history.push({ status: "in_progress", at: incident.updatedAt });
  } else if (incident.status === "on_hold") {
    history.push({ status: "on_hold", at: incident.updatedAt });
  } else if (incident.status === "completed") {
    history.push({ status: "completed", at: incident.resolvedAt ?? incident.updatedAt });
  } else if (incident.status === "canceled") {
    history.push({ status: "canceled", at: incident.updatedAt });
  }
  return history;
}

function Row({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  editBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-end" },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    textAlign: "center",
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pendingBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#92400e",
  },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold" },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  section: { borderRadius: 16, padding: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#00000010",
  },
  rowLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 12 },
  descText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  historyContent: { flex: 1 },
  historyStatus: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  historyTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 16,
    marginTop: 4,
  },
  actionBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    height: 100,
    paddingTop: 11,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  priorityChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  saveBtn: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
});
