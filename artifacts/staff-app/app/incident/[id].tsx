import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
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

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const YELLOW = "#F5C518";

type Colors = ReturnType<typeof useColors>;

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

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  objectPath: string;
}

async function fetchIncident(companyId: string, id: string): Promise<IncidentDetail> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/service-requests/${id}`, {
    headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId },
  });
  if (!res.ok) throw new Error("Not found");
  return (await res.json()).data as IncidentDetail;
}

async function fetchAttachments(companyId: string, id: string): Promise<Attachment[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `${BASE_URL}/api/attachments?entityType=incident&entityId=${id}`,
    { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as Attachment[];
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

export default function IncidentDetailScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

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
            setActionLoading(true);
            try {
              const updated = await updateStatus(companyId, incident.id, newStatus);
              setIncident(updated);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSnackbar(t("toast.statusChanged"), "success");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : t("toast.actionFailed");
              showSnackbar(msg, "error");
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
        <View style={{ width: 40 }} />
      </View>

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

        {attachments.length > 0 ? (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("incidentDetail.photos")} ({attachments.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoList}
            >
              {attachments.map((att) => (
                <AttachmentThumb
                  key={att.id}
                  objectPath={att.objectPath}
                  fileName={att.fileName}
                  token={authToken}
                  colors={colors}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

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

function AttachmentThumb({
  objectPath, fileName, token, colors,
}: {
  objectPath: string;
  fileName: string;
  token: string | null;
  colors: Colors;
}) {
  const BASE_URL_INNER = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  const uri = `${BASE_URL_INNER}/api/storage${objectPath}`;

  return (
    <View style={styles.thumbWrap}>
      {token ? (
        <Image
          source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
          style={styles.thumbImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbPlaceholder, { backgroundColor: colors.muted }]}>
          <Feather name="image" size={20} color={colors.mutedForeground} />
        </View>
      )}
      <Text style={[styles.thumbName, { color: colors.mutedForeground }]} numberOfLines={1}>
        {fileName}
      </Text>
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: Colors }) {
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    textAlign: "center",
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
  photoList: { gap: 10, flexDirection: "row", flexWrap: "wrap" },
  thumbWrap: { width: 90, alignItems: "center", gap: 4 },
  thumbImage: { width: 90, height: 90, borderRadius: 10 },
  thumbPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbName: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
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
});
