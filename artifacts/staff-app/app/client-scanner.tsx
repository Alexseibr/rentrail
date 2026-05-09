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
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/api";
import { CameraView, useCameraPermissions } from "expo-camera";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const YELLOW = "#F5C518";

export default function ClientScannerScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { companyId } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const resolveCode = useCallback(
    async (code: string) => {
      setResolving(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${BASE_URL}/api/client/vehicles/lookup?code=${encodeURIComponent(code)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "x-company-id": companyId || "",
            },
          },
        );
        const json = (await res.json()) as {
          data?: { id: string };
          error?: { message?: string };
        };

        if (res.ok && json.data) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: "/(client-tabs)/vehicle-detail",
            params: { id: json.data.id },
          });
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            t("common.error"),
            json.error?.message || t("clientVehicles.vehicleNotFound"),
            [{ text: t("common.ok"), onPress: () => setScanned(false) }],
          );
        }
      } catch {
        Alert.alert(t("common.error"), t("clientVehicles.lookupFailed"), [
          { text: t("common.ok"), onPress: () => setScanned(false) },
        ]);
      } finally {
        setResolving(false);
      }
    },
    [companyId, router, t],
  );

  const handleBarCodeScanned = useCallback(
    ({ data: rawValue }: { data: string }) => {
      if (scanned || resolving) return;
      setScanned(true);
      resolveCode(rawValue.trim());
    },
    [scanned, resolving, resolveCode],
  );

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    setScanned(true);
    resolveCode(code);
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: "#1a1a1a" }]}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: "#1a1a1a" }]}>
        <View style={styles.permIconWrap}>
          <Feather name="camera-off" size={48} color="rgba(255,255,255,0.4)" />
        </View>
        <Text style={styles.permText}>{t("scanner.cameraAccessNeeded")}</Text>
        <Text style={styles.permSub}>
          {t("scanner.allowCameraDescription")}
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>{t("scanner.allowCamera")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== "web" ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "code128", "ean13", "code39"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />
      )}

      <View style={[styles.overlay, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("clientScanner.title")}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.frameHint}>{t("clientScanner.pointAt")}</Text>
        </View>

        {resolving && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={YELLOW} size="large" />
            <Text style={styles.loadingText}>{t("scanner.resolving")}</Text>
          </View>
        )}

        <View
          style={[styles.manualWrap, { paddingBottom: insets.bottom + 20 }]}
        >
          <Text style={styles.manualLabel}>{t("scanner.orEnterManually")}</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder={t("clientScanner.vehicleCode")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!manualCode.trim() || resolving) && { opacity: 0.5 },
              ]}
              onPress={handleManualSubmit}
              disabled={!manualCode.trim() || resolving}
            >
              <Feather name="arrow-right" size={20} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
          {scanned && !resolving && (
            <TouchableOpacity
              onPress={() => {
                setScanned(false);
                setManualCode("");
              }}
            >
              <Text style={styles.rescanText}>{t("scanner.scanAgain")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  permIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  permText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  permSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  permBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: YELLOW,
    marginTop: 8,
  },
  permBtnText: { color: "#1a1a1a", fontSize: 15, fontFamily: "Inter_700Bold" },
  closeBtn: { paddingVertical: 12 },
  closeBtnText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  frameWrap: { alignItems: "center", gap: 16 },
  frame: {
    width: 260,
    height: 260,
    position: "relative",
  },
  frameHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: YELLOW,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  loadingWrap: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingText: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  manualWrap: { paddingHorizontal: 24, gap: 10 },
  manualLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  manualRow: { flexDirection: "row", gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: YELLOW,
  },
  rescanText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginTop: 4,
    color: YELLOW,
  },
});
