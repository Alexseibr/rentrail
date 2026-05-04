import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { captureOrPick, type CapturedMedia } from "@/services/media";
import { uploadAndAttach } from "@/services/upload";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

export interface ExistingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  objectPath: string;
}

interface MediaAttachmentsProps {
  entityType: string;
  entityId: string;
  existingAttachments?: ExistingAttachment[];
  authToken?: string | null;
  readOnly?: boolean;
  onAttachmentCreated?: () => void;
}

interface LocalPhoto {
  media: CapturedMedia;
  status: "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
}

interface FullScreenItem {
  uri: string;
  headers?: Record<string, string>;
  label: string;
}

export function MediaAttachments({
  entityType,
  entityId,
  existingAttachments = [],
  authToken,
  readOnly = false,
  onAttachmentCreated,
}: MediaAttachmentsProps) {
  const colors = useColors();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [fullScreen, setFullScreen] = useState<FullScreenItem | null>(null);

  const openFullScreen = (item: FullScreenItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFullScreen(item);
  };

  const addPhoto = async () => {
    const media = await captureOrPick();
    if (!media) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const photo: LocalPhoto = { media, status: "pending" };
    setPhotos((prev) => [...prev, photo]);

    setPhotos((prev) =>
      prev.map((p) => (p.media.uri === media.uri ? { ...p, status: "uploading" } : p)),
    );

    const result = await uploadAndAttach({
      media,
      entityType,
      entityId,
    });

    setPhotos((prev) =>
      prev.map((p) =>
        p.media.uri === media.uri
          ? { ...p, status: result.success ? "uploaded" : "failed", error: result.error }
          : p,
      ),
    );

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAttachmentCreated?.();
    }
  };

  const retryUpload = async (photo: LocalPhoto) => {
    setPhotos((prev) =>
      prev.map((p) => (p.media.uri === photo.media.uri ? { ...p, status: "uploading" } : p)),
    );

    const result = await uploadAndAttach({
      media: photo.media,
      entityType,
      entityId,
    });

    setPhotos((prev) =>
      prev.map((p) =>
        p.media.uri === photo.media.uri
          ? { ...p, status: result.success ? "uploaded" : "failed", error: result.error }
          : p,
      ),
    );
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.media.uri !== uri));
  };

  const hasContent = existingAttachments.length > 0 || photos.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          Photos{existingAttachments.length > 0 ? ` (${existingAttachments.length})` : ""}
        </Text>
        {!readOnly && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.secondary }]}
            onPress={addPhoto}
            activeOpacity={0.7}
          >
            <Feather name="camera" size={16} color={colors.primary} />
            <Text style={[styles.addText, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {hasContent && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {existingAttachments.map((att) => {
            const uri = `${BASE_URL}/api/storage${att.objectPath}`;
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
            return (
              <TouchableOpacity
                key={att.id}
                style={styles.photoWrap}
                activeOpacity={0.85}
                onPress={() => openFullScreen({ uri, headers, label: att.fileName })}
              >
                <Image
                  source={headers ? { uri, headers } : { uri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <View style={[styles.existingBadge, { backgroundColor: colors.card }]}>
                  <Feather name="maximize-2" size={10} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          })}

          {photos.map((photo) => (
            <TouchableOpacity
              key={photo.media.uri}
              style={styles.photoWrap}
              activeOpacity={photo.status === "uploaded" ? 0.85 : 1}
              onPress={() =>
                photo.status === "uploaded"
                  ? openFullScreen({ uri: photo.media.uri, label: "Photo" })
                  : undefined
              }
            >
              <Image source={{ uri: photo.media.uri }} style={styles.photo} />
              {photo.status === "uploading" && (
                <View style={styles.overlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
              {photo.status === "uploaded" && (
                <View style={[styles.badge, { backgroundColor: colors.success }]}>
                  <Feather name="check" size={10} color="#fff" />
                </View>
              )}
              {photo.status === "failed" && (
                <TouchableOpacity
                  style={[styles.badge, { backgroundColor: colors.destructive }]}
                  onPress={() => retryUpload(photo)}
                >
                  <Feather name="refresh-cw" size={10} color="#fff" />
                </TouchableOpacity>
              )}
              {!readOnly && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removePhoto(photo.media.uri)}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!hasContent && readOnly && (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No photos attached
        </Text>
      )}

      <Modal
        visible={fullScreen !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreen(null)}
        statusBarTranslucent={Platform.OS === "android"}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFullScreen(null)} />
          {fullScreen && (
            <View style={styles.modalContent}>
              <Image
                source={
                  fullScreen.headers
                    ? { uri: fullScreen.uri, headers: fullScreen.headers }
                    : { uri: fullScreen.uri }
                }
                style={styles.fullImage}
                resizeMode="contain"
              />
              {fullScreen.label ? (
                <Text style={styles.imageLabel} numberOfLines={1}>
                  {fullScreen.label}
                </Text>
              ) : null}
            </View>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={() => setFullScreen(null)}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { gap: 8, paddingVertical: 4 },
  photoWrap: { position: "relative", width: 80, height: 80, borderRadius: 8, overflow: "hidden" },
  photo: { width: 80, height: 80 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  existingBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.85,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH,
    alignItems: "center",
    gap: 10,
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  imageLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 24,
    textAlign: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
});
