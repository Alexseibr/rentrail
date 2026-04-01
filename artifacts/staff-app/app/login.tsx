import React, { useState } from "react";
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

const DEMO_ACCOUNTS = [
  { label: "Owner", email: "owner@velocityrides.demo", color: "#7c3aed" },
  { label: "Admin", email: "admin@velocityrides.demo", color: "#2563eb" },
  { label: "Manager", email: "manager@velocityrides.demo", color: "#0891b2" },
  { label: "Operator", email: "operator@velocityrides.demo", color: "#059669" },
  { label: "Mechanic", email: "mechanic@velocityrides.demo", color: "#d97706" },
  { label: "Viewer", email: "viewer@velocityrides.demo", color: "#64748b" },
];

const DEMO_PASSWORD = "demo1234";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handleLogin = async (loginEmail = email, loginPassword = password) => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Please enter email and password");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError(null);
    setDemoLoading(demoEmail);
    try {
      await login(demoEmail, DEMO_PASSWORD);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(null);
    }
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
          Sign in to manage your fleet
        </Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="mail" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            testID="login-email"
          />
        </View>

        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="lock" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            testID="login-password"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, opacity: loading || !!demoLoading ? 0.7 : 1 }]}
          onPress={() => handleLogin()}
          disabled={loading || !!demoLoading}
          activeOpacity={0.8}
          testID="login-submit"
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.demoBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.demoTitle, { color: colors.mutedForeground }]}>
          Demo — tap to enter
        </Text>
        <View style={styles.demoGrid}>
          {DEMO_ACCOUNTS.map((acc) => (
            <TouchableOpacity
              key={acc.email}
              style={[styles.demoBtn, { backgroundColor: acc.color }]}
              onPress={() => handleDemoLogin(acc.email)}
              disabled={!!demoLoading || loading}
              activeOpacity={0.8}
            >
              {demoLoading === acc.email ? (
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
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  form: { gap: 14 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  demoBox: {
    marginTop: 32,
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: "dashed",
    padding: 16,
    gap: 12,
  },
  demoTitle: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
  demoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  demoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  demoBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  demoHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
