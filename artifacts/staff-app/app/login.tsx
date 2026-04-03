import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

type Step = "phone" | "password" | "otp" | "set-password";

const DEMO_ACCOUNTS = [
  { label: "Owner",    phone: "+79991000001" },
  { label: "Admin",    phone: "+79991000002" },
  { label: "Manager",  phone: "+79991000003" },
  { label: "Operator", phone: "+79991000004" },
  { label: "Mechanic", phone: "+79991000005" },
  { label: "Viewer",   phone: "+79991000006" },
];

const DEMO_PASSWORD = "demo1234";

export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithPhone, requestOtp, verifyOtp, setPhonePassword } = useAuth();

  const [step, setStep]         = useState<Step>("phone");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode]   = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [devCode, setDevCode]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const otpRef = useRef<TextInput>(null);

  const busy = loading || !!demoLoading;

  const handlePhoneContinue = () => {
    if (!phone.trim()) return;
    setError(null);
    setStep("password");
  };

  const handlePasswordLogin = async () => {
    if (!password.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await loginWithPhone(phone.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("login.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestOtp(phone.trim());
      setDevCode(result.devCode ?? null);
      setOtpCode("");
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.failedToSendCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const { needsPassword } = await verifyOtp(phone.trim(), otpCode);
      if (needsPassword) {
        setNewPassword("");
        setStep("set-password");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("login.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      await setPhonePassword(newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.failedToSetPassword"));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoPhone: string) => {
    setError(null);
    setDemoLoading(demoPhone);
    try {
      await loginWithPhone(demoPhone, DEMO_PASSWORD);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("login.demoLoginFailed"));
    } finally {
      setDemoLoading(null);
    }
  };

  const stepTitle: Record<Step, string> = {
    phone:        t("login.signInToManage"),
    password:     t("login.welcomeBack"),
    otp:          t("login.enterYourCode"),
    "set-password": t("login.createPassword"),
  };

  const stepSubtitle: Record<Step, string> = {
    phone:        t("login.enterPhone"),
    password:     phone,
    otp:          t("login.codeSentTo", { phone }),
    "set-password": t("login.noCodeNextTime"),
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Platform.OS === "web" ? 67 + insets.top : insets.top + 40,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: "#1a1a1a" }}
    >
      <View style={styles.logoWrap}>
        <View style={styles.logoCircle}>
          <Feather name="truck" size={32} color="#1a1a1a" />
        </View>
        <Text style={styles.brandName}>RideFlow</Text>
        <Text style={styles.subtitle}>
          {stepTitle[step]}
        </Text>
        {step !== "phone" && (
          <Text style={styles.stepHint}>
            {stepSubtitle[step]}
          </Text>
        )}
      </View>

      <View style={styles.formCard}>
        {error && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color="#E53935" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {step === "phone" && (
          <>
            <View style={styles.inputWrap}>
              <Feather name="phone" size={18} color="#8c8c8c" />
              <TextInput
                style={styles.input}
                placeholder="+7 999 100 0001"
                placeholderTextColor="#bbb"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.button, { opacity: busy || !phone.trim() ? 0.6 : 1 }]}
              onPress={handlePhoneContinue}
              disabled={busy || !phone.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{t("login.continue")}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "password" && (
          <>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color="#8c8c8c" />
              <TextInput
                style={styles.input}
                placeholder={t("login.password")}
                placeholderTextColor="#bbb"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoFocus
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#8c8c8c" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.button, { opacity: busy ? 0.7 : 1 }]}
              onPress={handlePasswordLogin}
              disabled={busy}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#1a1a1a" size="small" /> : <Text style={styles.buttonText}>{t("login.signIn")}</Text>}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => { setStep("phone"); setError(null); }}>
                <Text style={styles.linkTextLight}>{"\u2190"} {t("login.changeNumber")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendOtp} disabled={busy}>
                <Text style={[styles.linkTextAccent, { opacity: busy ? 0.5 : 1 }]}>
                  {loading ? t("login.sending") : t("login.getSmsCode")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === "otp" && (
          <>
            {devCode && (
              <View style={styles.devBanner}>
                <Text style={styles.devText}>{t("login.devModeCode")} <Text style={styles.devCode}>{devCode}</Text></Text>
              </View>
            )}
            <View style={styles.inputWrap}>
              <Feather name="hash" size={18} color="#8c8c8c" />
              <TextInput
                ref={otpRef}
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor="#bbb"
                value={otpCode}
                onChangeText={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.button, { opacity: busy || otpCode.length !== 6 ? 0.6 : 1 }]}
              onPress={handleVerifyOtp}
              disabled={busy || otpCode.length !== 6}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#1a1a1a" size="small" /> : <Text style={styles.buttonText}>{t("login.verifyCode")}</Text>}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => { setStep("password"); setError(null); }}>
                <Text style={styles.linkTextLight}>{"\u2190"} {t("login.back")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendOtp} disabled={busy}>
                <Text style={[styles.linkTextAccent, { opacity: busy ? 0.5 : 1 }]}>{t("login.resendCode")}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === "set-password" && (
          <>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color="#8c8c8c" />
              <TextInput
                style={styles.input}
                placeholder={t("login.minChars")}
                placeholderTextColor="#bbb"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoFocus
                autoCorrect={false}
                autoComplete="new-password"
              />
            </View>
            <TouchableOpacity
              style={[styles.button, { opacity: busy || newPassword.length < 6 ? 0.6 : 1 }]}
              onPress={handleSetPassword}
              disabled={busy || newPassword.length < 6}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#1a1a1a" size="small" /> : <Text style={styles.buttonText}>{t("login.setPasswordContinue")}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.demoBox}>
        <Text style={styles.demoTitle}>{t("login.demoTapToEnter")}</Text>
        <View style={styles.demoGrid}>
          {DEMO_ACCOUNTS.map((acc) => (
            <TouchableOpacity
              key={acc.phone}
              style={styles.demoBtn}
              onPress={() => handleDemoLogin(acc.phone)}
              disabled={busy}
              activeOpacity={0.8}
            >
              {demoLoading === acc.phone ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.demoBtnText}>{acc.label}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.demoHint}>
          {t("login.demoHint")} <Text style={{ fontFamily: "Inter_700Bold" }}>demo1234</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#F5C518",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  brandName: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#ffffff" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6, color: "rgba(255,255,255,0.6)" },
  stepHint: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4, color: "rgba(255,255,255,0.5)" },
  formCard: {
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
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, color: "#E53935" },
  devBanner: { padding: 12, borderRadius: 12, backgroundColor: "#FFF8E1" },
  devText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8B6914" },
  devCode: { fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 2 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#1a1a1a" },
  otpInput: { textAlign: "center", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 8 },
  button: {
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    backgroundColor: "#F5C518",
  },
  buttonText: { color: "#1a1a1a", fontSize: 16, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  linkTextLight: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8c8c8c" },
  linkTextAccent: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#F5C518" },
  demoBox: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  demoTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.5)",
  },
  demoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  demoBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    alignItems: "center",
    backgroundColor: "#F5C518",
  },
  demoBtnText: { color: "#1a1a1a", fontSize: 13, fontFamily: "Inter_700Bold" },
  demoHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    color: "rgba(255,255,255,0.4)",
  },
});
