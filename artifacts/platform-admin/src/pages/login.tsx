import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { Bike, ArrowLeft } from "lucide-react";

type Step = "phone" | "password" | "otp" | "set-password";

const DEMO_ACCOUNTS = [
  { label: "Velocity Rides (Owner)", phone: "+79991000001", color: "bg-sidebar hover:bg-sidebar/90 text-sidebar-foreground" },
  { label: "Velocity Rides (Admin)", phone: "+79991000002", color: "bg-sidebar hover:bg-sidebar/90 text-sidebar-foreground" },
  { label: "Urban Wheels (Owner)",   phone: "+79991000008", color: "bg-sidebar hover:bg-sidebar/90 text-sidebar-foreground" },
  { label: "Velocity Rides (Operator)", phone: "+79991000004", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
];

const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const { loginWithPhone, requestOtp, verifyOtp, setPhonePassword } = useAuth();
  const { t } = useTranslation();

  const [step, setStep]         = useState<Step>("phone");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode]   = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [devCode, setDevCode]   = useState<string | null>(null);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handlePhoneContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setError("");
    setStep("password");
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithPhone(phone.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message || t("login.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await requestOtp(phone.trim());
      setDevCode(result.devCode ?? null);
      setOtpCode("");
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message || t("login.codeSendFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { needsPassword } = await verifyOtp(phone.trim(), otpCode.trim());
      if (needsPassword) {
        setNewPassword("");
        setStep("set-password");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message || t("login.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await setPhonePassword(newPassword);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message || t("login.setPasswordFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoPhone: string) => {
    setError("");
    setDemoLoading(demoPhone);
    try {
      await loginWithPhone(demoPhone, DEMO_PASSWORD);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.demoLoginFailed"));
    } finally {
      setDemoLoading(null);
    }
  };

  const busy = loading || !!demoLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar via-sidebar to-[hsl(220,20%,18%)] px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, hsl(45, 96%, 53%) 0%, transparent 50%),
                          radial-gradient(circle at 75% 75%, hsl(45, 96%, 53%) 0%, transparent 50%)`,
      }} />

      <div className="w-full max-w-sm space-y-5 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4">
            <Bike className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white">RideFlow</h1>
          <p className="text-sm text-white/50 mt-1">{t("login.title")}</p>
        </div>

        <div className="bg-card rounded-2xl shadow-xl p-6">
          <div className="text-center mb-5">
            <p className="text-sm text-muted-foreground">
              {step === "phone"         && t("login.enterPhone")}
              {step === "password"      && t("login.signInAs", { phone })}
              {step === "otp"           && t("login.enterCode", { phone })}
              {step === "set-password"  && t("login.createPassword")}
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">
              {error}
            </div>
          )}

          {step === "phone" && (
            <form onSubmit={handlePhoneContinue} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">{t("login.phoneLabel")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 999 000 0001"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                  autoComplete="tel"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {t("login.continue")}
              </Button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">{t("login.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {loading ? t("login.signingIn") : t("login.signIn")}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setError(""); }}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {t("login.changeNumber")}
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={busy}
                  className="text-primary hover:text-primary/80 font-medium disabled:opacity-50 transition-colors"
                >
                  {loading ? t("login.sending") : t("login.getSmsCode")}
                </button>
              </div>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {devCode && (
                <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-foreground">
                  {t("login.devModeCode")} <span className="font-mono font-bold text-lg">{devCode}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-sm font-medium">{t("login.digitCode")}</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || otpCode.length !== 6}>
                {loading ? t("login.verifying") : t("login.verifyCode")}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("password"); setError(""); }}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {t("common.back")}
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={busy}
                  className="text-primary hover:text-primary/80 font-medium disabled:opacity-50 transition-colors"
                >
                  {t("login.resendCode")}
                </button>
              </div>
            </form>
          )}

          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("login.setPasswordHint")}
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium">{t("login.newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder={t("login.minChars")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || newPassword.length < 6}>
                {loading ? t("common.saving") : t("login.setPasswordContinue")}
              </Button>
            </form>
          )}
        </div>

        <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg p-5">
          <p className="text-xs text-muted-foreground text-center mb-3 font-medium uppercase tracking-wider">
            {t("login.demoAccess")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.phone}
                onClick={() => handleDemoLogin(acc.phone)}
                disabled={busy}
                className={`${acc.color} text-xs font-medium rounded-xl px-3 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
              >
                {demoLoading === acc.phone ? "..." : acc.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {t("login.testNumbers")} <span className="font-mono text-foreground/70">+7 999 000 000X</span>
          </p>
        </div>
      </div>
    </div>
  );
}
