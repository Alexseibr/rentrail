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
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

type Step =
  | "email"
  | "password"
  | "otp"
  | "set-password"
  | "phone"
  | "phone-password"
  | "phone-otp";
type LoginMode = "staff" | "client";

const DEMO_STAFF_ACCOUNTS = [
  { label: "Owner", email: "owner@velocityrides.demo" },
  { label: "Admin", email: "admin@velocityrides.demo" },
  { label: "Manager", email: "manager@velocityrides.demo" },
  { label: "Operator", email: "operator@velocityrides.demo" },
  { label: "Mechanic", email: "mechanic@velocityrides.demo" },
  { label: "Viewer", email: "viewer@velocityrides.demo" },
];

const DEMO_CLIENT_ACCOUNTS = [
  { label: "Alex T.", phone: "+1-555-1000" },
  { label: "Jessica W.", phone: "+1-555-1001" },
  { label: "Michael B.", phone: "+1-555-1002" },
];

const DEMO_STAFF_PASSWORD = "demo1234";
const DEMO_CLIENT_PASSWORD = "client123";

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { company } = useCompany();
  const {
    loginWithEmail,
    loginAsClient,
    requestEmailOtp,
    verifyEmailOtp,
    setEmailPassword,
    requestOtp,
    verifyOtp,
    setPhonePassword,
  } = useAuth();

  const [mode, setMode] = useState<LoginMode>("staff");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const otpRef = useRef<TextInput>(null);

  const busy = loading || !!demoLoading;

  const handleEmailContinue = () => {
    if (!email.trim()) return;
    setError(null);
    setStep("password");
  };

  const handlePasswordLogin = async () => {
    if (!password.trim()) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "client") {
        await loginAsClient(phone.trim(), password);
      } else {
        await loginWithEmail(email.trim(), password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        err instanceof Error ? err.message : t("login.invalidCredentials"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestEmailOtp(email.trim());
      setDevCode(result.devCode ?? null);
      setOtpCode("");
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 200);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("login.failedToSendCode"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (otpCode.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const { needsPassword } = await verifyEmailOtp(email.trim(), otpCode);
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

  const handleSetEmailPassword = async () => {
    if (newPassword.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      await setEmailPassword(newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("login.failedToSetPassword"),
      );
    } finally {
      setLoading(false);
    }
  };

  // Client phone flow
  const handlePhoneContinue = () => {
    if (!phone.trim()) return;
    setError(null);
    setStep("phone-password");
  };

  const handleClientPasswordLogin = async () => {
    if (!password.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await loginAsClient(phone.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        err instanceof Error ? err.message : t("login.invalidCredentials"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestOtp(phone.trim());
      setDevCode(result.devCode ?? null);
      setOtpCode("");
      setStep("phone-otp");
      setTimeout(() => otpRef.current?.focus(), 200);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("login.failedToSendCode"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
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

  const handleSetPhonePassword = async () => {
    if (newPassword.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      await setPhonePassword(newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("login.failedToSetPassword"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoStaffLogin = async (demoEmail: string) => {
    setError(null);
    setDemoLoading(demoEmail);
    try {
      await loginWithEmail(demoEmail, DEMO_STAFF_PASSWORD);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("login.demoLoginFailed"));
    } finally {
      setDemoLoading(null);
    }
  };

  const handleDemoClientLogin = async (demoPhone: string) => {
    setError(null);
    setDemoLoading(demoPhone);
    try {
      await loginAsClient(demoPhone, DEMO_CLIENT_PASSWORD);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("login.demoLoginFailed"));
    } finally {
      setDemoLoading(null);
    }
  };

  const handleModeSwitch = (newMode: LoginMode) => {
    setMode(newMode);
    setStep(newMode === "staff" ? "email" : "phone");
    setEmail("");
    setPhone("");
    setPassword("");
    setError(null);
  };

  const isEmailStep =
    step === "email" ||
    step === "password" ||
    step === "otp" ||
    step === "set-password";
  const isPhoneStep =
    step === "phone" || step === "phone-password" || step === "phone-otp";

  const stepTitle = (() => {
    if (mode === "client") return t("login.signInToRent");
    switch (step) {
      case "email":
        return t("login.signInToManage");
      case "password":
        return t("login.welcomeBack");
      case "otp":
        return t("login.enterYourCode");
      case "set-password":
        return t("login.createPassword");
      default:
        return t("login.signInToManage");
    }
  })();

  const stepHint = (() => {
    switch (step) {
      case "password":
        return email;
      case "otp":
        return t("login.codeSentToEmail", { email });
      default:
        return null;
    }
  })();

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
        {mode === "staff" && company ? (
          company.logoUrl ? (
            <Image
              source={{ uri: company.logoUrl }}
              style={styles.companyLogoImg}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                styles.logoCircle,
                { backgroundColor: company.primaryColor },
              ]}
            >
              <Text style={styles.companyInitial}>
                {company.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.logoCircle}>
            <Feather
              name={mode === "client" ? "smartphone" : "truck"}
              size={32}
              color="#1a1a1a"
            />
          </View>
        )}
        <Text style={styles.brandName}>
          {mode === "staff" && company ? company.name : "RideFlow"}
        </Text>
        {mode === "staff" && company && (
          <TouchableOpacity
            onPress={() => router.replace("/company-select" as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.changeCompanyLink}>
              {t("login.changeCompany", "Сменить компанию")}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "staff" && styles.modeBtnActive]}
            onPress={() => handleModeSwitch("staff")}
            activeOpacity={0.8}
          >
            <Feather
              name="briefcase"
              size={14}
              color={mode === "staff" ? "#1a1a1a" : "rgba(255,255,255,0.5)"}
            />
            <Text
              style={[
                styles.modeBtnText,
                mode === "staff" && styles.modeBtnTextActive,
              ]}
            >
              {t("login.staffMode")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "client" && styles.modeBtnActive]}
            onPress={() => handleModeSwitch("client")}
            activeOpacity={0.8}
          >
            <Feather
              name="user"
              size={14}
              color={mode === "client" ? "#1a1a1a" : "rgba(255,255,255,0.5)"}
            />
            <Text
              style={[
                styles.modeBtnText,
                mode === "client" && styles.modeBtnTextActive,
              ]}
            >
              {t("login.clientMode")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>{stepTitle}</Text>
        {stepHint && <Text style={styles.stepHint}>{stepHint}</Text>}
      </View>

      <View style={styles.formCard}>
        {error && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color="#E53935" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Staff: email step */}
        {step === "email" && (
          <>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={18} color="#8c8c8c" />
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[
                styles.button,
                { opacity: busy || !email.trim() ? 0.6 : 1 },
              ]}
              onPress={handleEmailContinue}
              disabled={busy || !email.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{t("login.continue")}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Staff: password step */}
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
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color="#8c8c8c"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.button, { opacity: busy ? 0.7 : 1 }]}
              onPress={handlePasswordLogin}
              disabled={busy}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonText}>{t("login.signIn")}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => {
                  setStep("email");
                  setError(null);
                }}
              >
                <Text style={styles.linkTextLight}>
                  {"\u2190"} {t("login.changeEmail", "Изменить email")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendEmailOtp} disabled={busy}>
                <Text
                  style={[styles.linkTextAccent, { opacity: busy ? 0.5 : 1 }]}
                >
                  {loading
                    ? t("login.sending")
                    : t("login.getEmailCode", "Код на почту")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Staff: email OTP step */}
        {step === "otp" && (
          <>
            {devCode && (
              <View style={styles.devBanner}>
                <Text style={styles.devText}>
                  {t("login.devModeCode")}{" "}
                  <Text style={styles.devCode}>{devCode}</Text>
                </Text>
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
                onChangeText={(v) =>
                  setOtpCode(v.replace(/\D/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[
                styles.button,
                { opacity: busy || otpCode.length !== 6 ? 0.6 : 1 },
              ]}
              onPress={handleVerifyEmailOtp}
              disabled={busy || otpCode.length !== 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonText}>{t("login.verifyCode")}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => {
                  setStep("password");
                  setError(null);
                }}
              >
                <Text style={styles.linkTextLight}>
                  {"\u2190"} {t("login.back")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendEmailOtp} disabled={busy}>
                <Text
                  style={[styles.linkTextAccent, { opacity: busy ? 0.5 : 1 }]}
                >
                  {t("login.resendCode")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Set password (email flow) */}
        {step === "set-password" && isEmailStep && (
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
              style={[
                styles.button,
                { opacity: busy || newPassword.length < 6 ? 0.6 : 1 },
              ]}
              onPress={handleSetEmailPassword}
              disabled={busy || newPassword.length < 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {t("login.setPasswordContinue")}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Client: phone step */}
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
              style={[
                styles.button,
                { opacity: busy || !phone.trim() ? 0.6 : 1 },
              ]}
              onPress={handlePhoneContinue}
              disabled={busy || !phone.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{t("login.continue")}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Client: phone-password step */}
        {step === "phone-password" && (
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
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color="#8c8c8c"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.button, { opacity: busy ? 0.7 : 1 }]}
              onPress={handleClientPasswordLogin}
              disabled={busy}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonText}>{t("login.signIn")}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => {
                  setStep("phone");
                  setError(null);
                }}
              >
                <Text style={styles.linkTextLight}>
                  {"\u2190"} {t("login.changeNumber")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendPhoneOtp} disabled={busy}>
                <Text
                  style={[styles.linkTextAccent, { opacity: busy ? 0.5 : 1 }]}
                >
                  {loading ? t("login.sending") : t("login.getSmsCode")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Client: phone OTP step */}
        {step === "phone-otp" && (
          <>
            {devCode && (
              <View style={styles.devBanner}>
                <Text style={styles.devText}>
                  {t("login.devModeCode")}{" "}
                  <Text style={styles.devCode}>{devCode}</Text>
                </Text>
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
                onChangeText={(v) =>
                  setOtpCode(v.replace(/\D/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[
                styles.button,
                { opacity: busy || otpCode.length !== 6 ? 0.6 : 1 },
              ]}
              onPress={handleVerifyPhoneOtp}
              disabled={busy || otpCode.length !== 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonText}>{t("login.verifyCode")}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => {
                  setStep("phone-password");
                  setError(null);
                }}
              >
                <Text style={styles.linkTextLight}>
                  {"\u2190"} {t("login.back")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendPhoneOtp} disabled={busy}>
                <Text
                  style={[styles.linkTextAccent, { opacity: busy ? 0.5 : 1 }]}
                >
                  {t("login.resendCode")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Set password (phone flow) */}
        {step === "set-password" && isPhoneStep && (
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
              style={[
                styles.button,
                { opacity: busy || newPassword.length < 6 ? 0.6 : 1 },
              ]}
              onPress={handleSetPhonePassword}
              disabled={busy || newPassword.length < 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {t("login.setPasswordContinue")}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.demoBox}>
        <Text style={styles.demoTitle}>{t("login.demoTapToEnter")}</Text>
        <View style={styles.demoGrid}>
          {mode === "client"
            ? DEMO_CLIENT_ACCOUNTS.map((acc) => (
                <TouchableOpacity
                  key={acc.phone}
                  style={styles.demoBtn}
                  onPress={() => handleDemoClientLogin(acc.phone)}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  {demoLoading === acc.phone ? (
                    <ActivityIndicator color="#1a1a1a" size="small" />
                  ) : (
                    <Text style={styles.demoBtnText}>{acc.label}</Text>
                  )}
                </TouchableOpacity>
              ))
            : DEMO_STAFF_ACCOUNTS.map((acc) => (
                <TouchableOpacity
                  key={acc.email}
                  style={styles.demoBtn}
                  onPress={() => handleDemoStaffLogin(acc.email)}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  {demoLoading === acc.email ? (
                    <ActivityIndicator color="#1a1a1a" size="small" />
                  ) : (
                    <Text style={styles.demoBtnText}>{acc.label}</Text>
                  )}
                </TouchableOpacity>
              ))}
        </View>
        <Text style={styles.demoHint}>
          {t("login.demoHint")}{" "}
          <Text style={{ fontFamily: "Inter_700Bold" }}>
            {mode === "client" ? "client123" : "demo1234"}
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
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
  companyLogoImg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginBottom: 16,
  },
  companyInitial: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
  },
  changeCompanyLink: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#F5C518",
    marginBottom: 10,
    textDecorationLine: "underline",
  },
  brandName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 6,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 8,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
  },
  modeBtnActive: {
    backgroundColor: "#F5C518",
  },
  modeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
  },
  modeBtnTextActive: {
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    color: "rgba(255,255,255,0.6)",
  },
  stepHint: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
    color: "rgba(255,255,255,0.5)",
  },
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
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    color: "#E53935",
  },
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
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#1a1a1a",
  },
  otpInput: {
    textAlign: "center",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 8,
  },
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
  linkTextLight: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#8c8c8c",
  },
  linkTextAccent: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#F5C518",
  },
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
  demoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
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
