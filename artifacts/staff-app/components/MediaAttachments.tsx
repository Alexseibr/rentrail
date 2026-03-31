import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { captureOrPick, type CapturedMedia } from "@/services/media";
import { uploadAndAttach } from "@/services/upload";

interface MediaAttachmentsProps {
  entityType: string;
  entityId: string;
  onAttachmentCreated?: () => void;
}

interface LocalPhoto {
  media: CapturedMedia;
  status: "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
}

export function MediaAttachments({
  entityType,
  entityId,
  onAttachmentCreated,
}: MediaAttachmentsProps) {
  const colors = useColors();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.foreground }]}>Photos</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.secondary }]}
          onPress={addPhoto}
          activeOpacity={0.7}
        >
          <Feather name="camera" size={16} color={colors.primary} />
          <Text style={[styles.addText, { color: colors.primary }]}>Add</Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {photos.map((photo) => (
            <View key={photo.media.uri} style={styles.photoWrap}>
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
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removePhoto(photo.media.uri)}
              >
                <Feather name="x" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
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
});
