import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { CameraView, useCameraPermissions } from "expo-camera";

import { useCompany, type CompanyInfo } from "@/contexts/CompanyContext";

const YELLOW = "#F5C518";

export default function CompanySelectScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resolveAndSelectCompany } = useCompany();

  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<CompanyInfo | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const resolveSlug = useCallback(
    async (code: string) => {
      const trimmed = code.trim().toLowerCase();
      if (!trimmed) return;
      setError(null);
      setLoading(true);
      setResolved(null);
      try {
        const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
        const res = await fetch(
          `${BASE_URL}/api/companies/resolve/${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) {
          setError(
            res.status === 404
              ? t("companySelect.notFound", "Компания не найдена")
              : t("companySelect.fetchError", "Ошибка сети"),
          );
          return;
        }
        const json = (await res.json()) as { data: CompanyInfo };
        setResolved(json.data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        setError(t("companySelect.fetchError", "Ошибка сети"));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);
      setShowCamera(false);

      const match = data.match(/company\/([^/?#\s]+)/);
      const code = match ? match[1] : data.trim();
      setSlug(code);
      void resolveSlug(code);
    },
    [scanned, resolveSlug],
  );

  const handleOpenCamera = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setScanned(false);
    setShowCamera(true);
  }, [permission, requestPermission]);

  const handleContinue = useCallback(async () => {
    if (!resolved) return;
    setLoading(true);
    try {
      await resolveAndSelectCompany(resolved.slug);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/login");
    } catch {
      setError(t("companySelect.fetchError", "Ошибка сети"));
    } finally {
      setLoading(false);
    }
  }, [resolved, resolveAndSelectCompany, router, t]);

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        <View style={[styles.cameraTopBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.cameraClose}
            onPress={() => setShowCamera(false)}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.cameraHint}>
            {t("companySelect.scanHint", "Наведите камеру на QR-код")}
          </Text>
        </View>
        <View style={styles.scanFrame} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: Platform.OS === "web" ? 80 : insets.top + 48,
          paddingBottom: insets.bottom + 32,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: "#1a1a1a" }}
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Feather name="grid" size={32} color="#1a1a1a" />
        </View>
        <Text style={styles.title}>
          {t("companySelect.title", "Выбор компании")}
        </Text>
        <Text style={styles.subtitle}>
          {t(
            "companySelect.subtitle",
            "Введите код компании или отсканируйте QR",
          )}
        </Text>
      </View>

      <View style={styles.card}>
        {error && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color="#E53935" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Feather name="hash" size={18} color="#8c8c8c" />
            <TextInput
              style={styles.input}
              placeholder={t("companySelect.codePlaceholder", "код компании")}
              placeholderTextColor="#bbb"
              value={slug}
              onChangeText={(v) => {
                setSlug(v);
                setResolved(null);
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => void resolveSlug(slug)}
            />
          </View>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={handleOpenCamera}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={20} color="#1a1a1a" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.findBtn,
            { opacity: loading || !slug.trim() ? 0.6 : 1 },
          ]}
          onPress={() => void resolveSlug(slug)}
          disabled={loading || !slug.trim()}
          activeOpacity={0.8}
        >
          {loading && !resolved ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <Text style={styles.findBtnText}>
              {t("companySelect.find", "Найти")}
            </Text>
          )}
        </TouchableOpacity>

        {resolved && (
          <View style={styles.companyCard}>
            {resolved.logoUrl ? (
              <Image
                source={{ uri: resolved.logoUrl }}
                style={styles.companyLogo}
                resizeMode="contain"
              />
            ) : (
              <View
                style={[
                  styles.companyLogoPlaceholder,
                  { backgroundColor: resolved.primaryColor },
                ]}
              >
                <Text style={styles.companyLogoInitial}>
                  {resolved.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{resolved.name}</Text>
              <Text style={styles.companySlug}>/{resolved.slug}</Text>
            </View>
            <Feather name="check-circle" size={22} color="#4caf50" />
          </View>
        )}

        {resolved && (
          <TouchableOpacity
            style={[styles.continueBtn, { opacity: loading ? 0.6 : 1 }]}
            onPress={() => void handleContinue()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a1a" size="small" />
            ) : (
              <Text style={styles.continueBtnText}>
                {t("companySelect.continue", "Продолжить")}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  header: { alignItems: "center", marginBottom: 32 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: YELLOW,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    gap: 14,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FDEDED",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    color: "#E53935",
  },
  inputRow: { flexDirection: "row", gap: 10 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#1a1a1a",
  },
  scanBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: YELLOW,
    justifyContent: "center",
    alignItems: "center",
  },
  findBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  findBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  companyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#f5f5f5",
  },
  companyLogo: { width: 44, height: 44, borderRadius: 10 },
  companyLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  companyLogoInitial: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
  },
  companyInfo: { flex: 1 },
  companyName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#1a1a1a",
  },
  companySlug: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#8c8c8c",
    marginTop: 2,
  },
  continueBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: YELLOW,
    justifyContent: "center",
    alignItems: "center",
  },
  continueBtnText: {
    color: "#1a1a1a",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    gap: 8,
  },
  cameraClose: { alignSelf: "flex-end" },
  cameraHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
  scanFrame: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 220,
    height: 220,
    marginLeft: -110,
    marginTop: -110,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 16,
  },
});
