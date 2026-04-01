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
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

type Step = "phone" | "password" | "otp" | "set-password";

const DEMO_ACCOUNTS = [
  { label: "Owner",    phone: "+79991000001", color: "#7c3aed" },
  { label: "Admin",    phone: "+79991000002", color: "#2563eb" },
  { label: "Manager",  phone: "+79991000003", color: "#0891b2" },
  { label: "Operator", phone: "+79991000004", color: "#059669" },
  { label: "Mechanic", phone: "+79991000005", color: "#d97706" },
  { label: "Viewer",   phone: "+79991000006", color: "#64748b" },
];

const DEMO_PASSWORD = "demo1234";

export default function LoginScreen() {
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
      setError(err instanceof Error ? err.message : "Invalid credentials");
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
      setError(err instanceof Error ? err.message : "Failed to send code");
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
      setError(err instanceof Error ? err.message : "Invalid code");
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
      setError(err instanceof Error ? err.message : "Failed to set password");
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
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(null);
    }
  };

  const stepTitle: Record<Step, string> = {
    phone:        "Sign in to manage your fleet",
    password:     `Welcome back`,
    otp:          `Enter your code`,
    "set-password": "Create a password",
  };

  const stepSubtitle: Record<Step, string> = {
    phone:        "Enter your phone number",
    password:     phone,
    otp:          `Code sent to ${phone}`,
    "set-password": "You won't need a code next time",
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? 67 + insets.top : insets.top + 40,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logoWrap}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          <Feather name="truck" size={32} color="#fff" />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Staff Portal</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {stepTitle[step]}
        </Text>
        {step !== "phone" && (
          <Text style={[styles.stepHint, { color: colors.mutedForeground }]}>
            {stepSubtitle[step]}
          </Text>
        )}
      </View>

      <View style={styles.form}>
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {step === "phone" && (
          <>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="phone" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="+7 999 100 0001"
                placeholderTextColor={colors.mutedForeground}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, opacity: busy || !phone.trim() ? 0.6 : 1 }]}
              onPress={handlePhoneContinue}
              disabled={busy || !phone.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "password" && (
          <>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoFocus
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
              onPress={handlePasswordLogin}
              disabled={busy}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => { setStep("phone"); setError(null); }}>
                <Text style={[styles.linkText, { color: colors.mutedForeground }]}>← Change number</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendOtp} disabled={busy}>
                <Text style={[styles.linkText, { color: colors.primary, opacity: busy ? 0.5 : 1 }]}>
                  {loading ? "Sending..." : "Get SMS code"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === "otp" && (
          <>
            {devCode && (
              <View style={[styles.devBanner, { backgroundColor: "#fef3c7", borderColor: "#fcd34d" }]}>
                <Text style={styles.devText}>Dev mode — your code: <Text style={styles.devCode}>{devCode}</Text></Text>
              </View>
            )}
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="hash" size={18} color={colors.mutedForeground} />
              <TextInput
                ref={otpRef}
                style={[styles.input, styles.otpInput, { color: colors.foreground }]}
                placeholder="000000"
                placeholderTextColor={colors.mutedForeground}
                value={otpCode}
                onChangeText={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, opacity: busy || otpCode.length !== 6 ? 0.6 : 1 }]}
              onPress={handleVerifyOtp}
              disabled={busy || otpCode.length !== 6}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Verify Code</Text>}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => { setStep("password"); setError(null); }}>
                <Text style={[styles.linkText, { color: colors.mutedForeground }]}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendOtp} disabled={busy}>
                <Text style={[styles.linkText, { color: colors.primary, opacity: busy ? 0.5 : 1 }]}>Resend code</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === "set-password" && (
          <>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.mutedForeground}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoFocus
                autoCorrect={false}
                autoComplete="new-password"
              />
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, opacity: busy || newPassword.length < 6 ? 0.6 : 1 }]}
              onPress={handleSetPassword}
              disabled={busy || newPassword.length < 6}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Set Password & Continue</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={[styles.demoBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.demoTitle, { color: colors.mutedForeground }]}>Demo — tap to enter</Text>
        <View style={styles.demoGrid}>
          {DEMO_ACCOUNTS.map((acc) => (
            <TouchableOpacity
              key={acc.phone}
              style={[styles.demoBtn, { backgroundColor: acc.color }]}
              onPress={() => handleDemoLogin(acc.phone)}
              disabled={busy}
              activeOpacity={0.8}
            >
              {demoLoading === acc.phone ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.demoBtnText}>{acc.label}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.demoHint, { color: colors.mutedForeground }]}>
          Velocity Rides · пароль: <Text style={{ fontFamily: "Inter_600SemiBold" }}>demo1234</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 40 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  stepHint: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  form: { gap: 14 },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  devBanner: { padding: 12, borderRadius: 10, borderWidth: 1 },
  devText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400e" },
  devCode: { fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 2 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, height: 52, gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  otpInput: { textAlign: "center", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 8 },
  button: { height: 52, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  linkText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  demoBox: { marginTop: 32, borderWidth: 1, borderRadius: 16, borderStyle: "dashed", padding: 16, gap: 12 },
  demoTitle: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
  demoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  demoBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 90, alignItems: "center" },
  demoBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  demoHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
