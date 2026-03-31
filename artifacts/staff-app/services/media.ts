import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

export interface CapturedMedia {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
  capturedAt: string;
}

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Camera Permission Required",
      "Please allow camera access to take photos.",
    );
    return false;
  }
  return true;
}

export async function requestGalleryPermission(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Gallery Permission Required",
      "Please allow gallery access to select photos.",
    );
    return false;
  }
  return true;
}

export async function capturePhoto(): Promise<CapturedMedia | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
    capturedAt: new Date().toISOString(),
  };
}

export async function pickFromGallery(): Promise<CapturedMedia | null> {
  const hasPermission = await requestGalleryPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `picked_${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
    capturedAt: new Date().toISOString(),
  };
}

export async function captureOrPick(): Promise<CapturedMedia | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      pickFromGallery().then(resolve);
      return;
    }
    Alert.alert("Add Photo", "Choose how to add a photo", [
      { text: "Camera", onPress: () => capturePhoto().then(resolve) },
      { text: "Gallery", onPress: () => pickFromGallery().then(resolve) },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}
