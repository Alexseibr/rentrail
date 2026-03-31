import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { parseScanResult } from "@/services/scanner";
import { getAccessToken, getCompanyId } from "@/services/api";
import { useNetwork } from "@/services/network";
import { CameraView, useCameraPermissions } from "expo-camera";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function ScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isConnected } = useNetwork();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const resolveCode = useCallback(async (code: string) => {
    if (!isConnected) {
      Alert.alert("Offline", "Scan resolution requires internet connection");
      return;
    }

    setResolving(true);
    try {
      const token = await getAccessToken();
      const companyId = await getCompanyId();
      if (!token || !companyId) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/scan/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        Alert.alert("Error", "Failed to resolve code");
        return;
      }

      const { data } = await res.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (data.type === "asset") {
        router.replace(`/asset/${data.entity.id}`);
      } else if (data.type === "device") {
        Alert.alert("Device Found", `Device: ${data.entity.externalId}`);
      } else {
        Alert.alert("Not Found", `No asset or device found for code: ${code}`);
        setScanned(false);
      }
    } catch {
      Alert.alert("Error", "Failed to resolve scanned code");
      setScanned(false);
    } finally {
      setResolving(false);
    }
  }, [isConnected, router]);

  const handleBarCodeScanned = useCallback(
    ({ data: rawValue }: { data: string }) => {
      if (scanned || resolving) return;
      setScanned(true);
      const result = parseScanResult(rawValue);
      resolveCode(result.rawValue);
    },
    [scanned, resolving, resolveCode],
  );

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    setScanned(true);
    const result = parseScanResult(manualCode.trim());
    resolveCode(result.rawValue);
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="camera-off" size={48} color={colors.mutedForeground} />
        <Text style={[styles.permText, { color: colors.foreground }]}>Camera access needed</Text>
        <Text style={[styles.permSub, { color: colors.mutedForeground }]}>
          Allow camera access to scan QR codes and barcodes
        </Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      {Platform.OS !== "web" ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "ean13", "code39"] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
      ) : null}

      <View style={[styles.overlay, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>

        {resolving && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadingText}>Resolving...</Text>
          </View>
        )}

        <View style={[styles.manualWrap, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.manualLabel}>Or enter code manually</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Asset code..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleManualSubmit}
            >
              <Feather name="search" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {scanned && !resolving && (
            <TouchableOpacity onPress={() => setScanned(false)}>
              <Text style={[styles.rescanText, { color: colors.primary }]}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  permText: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 16 },
  permSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  permBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 12 },
  permBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
  },
  frame: {
    width: 250,
    height: 250,
    alignSelf: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#fff",
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  loadingWrap: { position: "absolute", top: "50%", alignSelf: "center", alignItems: "center", gap: 8 },
  loadingText: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  manualWrap: { paddingHorizontal: 24, gap: 8 },
  manualLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium" },
  manualRow: { flexDirection: "row", gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  rescanText: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center", marginTop: 4 },
});
