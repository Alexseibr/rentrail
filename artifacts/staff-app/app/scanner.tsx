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
import { useColors } from "@/hooks/useColors";
import { parseScanResult } from "@/services/scanner";
import { getAccessToken, getCompanyId } from "@/services/api";
import { useNetwork } from "@/services/network";
import { CameraView, useCameraPermissions } from "expo-camera";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const YELLOW = "#F5C518";

export default function ScannerScreen() {
  const { t } = useTranslation();
  const _colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isConnected } = useNetwork();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const resolveCode = useCallback(
    async (code: string) => {
      if (!isConnected) {
        Alert.alert(t("scanner.offline"), t("scanner.offlineMessage"));
        return;
      }

      setResolving(true);
      try {
        const token = await getAccessToken();
        const companyId = await getCompanyId();
        if (!token || !companyId) {
          Alert.alert(t("common.error"), t("scanner.notAuthenticated"));
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
          Alert.alert(t("common.error"), t("scanner.failedToResolve"));
          return;
        }

        const { data } = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (data.type === "asset") {
          router.replace(`/asset/${data.entity.id}`);
        } else if (data.type === "device") {
          Alert.alert(
            t("scanner.deviceFound"),
            `Device: ${data.entity.externalId}`,
          );
        } else {
          Alert.alert(
            t("scanner.notFound"),
            t("scanner.notFoundMessage", { code }),
          );
          setScanned(false);
        }
      } catch {
        Alert.alert(t("common.error"), t("scanner.failedToResolve"));
        setScanned(false);
      } finally {
        setResolving(false);
      }
    },
    [isConnected, router, t],
  );

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
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      {Platform.OS !== "web" ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "code128", "ean13", "code39"],
          }}
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
            <ActivityIndicator color={YELLOW} size="large" />
            <Text style={styles.loadingText}>{t("scanner.resolving")}</Text>
          </View>
        )}

        <View
          style={[styles.manualWrap, { paddingBottom: insets.bottom + 16 }]}
        >
          <Text style={styles.manualLabel}>{t("scanner.orEnterManually")}</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder={t("scanner.assetCode")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleManualSubmit}
            >
              <Feather name="search" size={18} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
          {scanned && !resolving && (
            <TouchableOpacity onPress={() => setScanned(false)}>
              <Text style={styles.rescanText}>{t("scanner.scanAgain")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    color: "#ffffff",
    textAlign: "center",
  },
  permSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
  },
  permBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    backgroundColor: YELLOW,
  },
  permBtnText: { color: "#1a1a1a", fontSize: 15, fontFamily: "Inter_700Bold" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
  },
  frame: {
    width: 260,
    height: 260,
    alignSelf: "center",
    position: "relative",
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
    top: "50%",
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
