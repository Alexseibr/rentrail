import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

type Step = "phone" | "password" | "otp" | "set-password";

const DEMO_ACCOUNTS = [
  { label: "Super Admin",    phone: "+79990000001", color: "bg-violet-600 hover:bg-violet-700" },
  { label: "Platform Admin", phone: "+79990000002", color: "bg-blue-600 hover:bg-blue-700" },
  { label: "Support",        phone: "+79990000003", color: "bg-sky-600 hover:bg-sky-700" },
  { label: "Finance",        phone: "+79990000004", color: "bg-emerald-600 hover:bg-emerald-700" },
];

const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const { loginWithPhone, requestOtp, verifyOtp, setPhonePassword } = useAuth();

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
      setError(err instanceof ApiError ? err.message : (err as Error).message || "Login failed");
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
      setError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to send code");
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
      setError(err instanceof ApiError ? err.message : (err as Error).message || "Invalid code");
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
      setError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to set password");
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
      setError(err instanceof ApiError ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(null);
    }
  };

  const busy = loading || !!demoLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Platform Admin</CardTitle>
            <CardDescription>
              {step === "phone"         && "Enter your phone number"}
              {step === "password"      && `Sign in as ${phone}`}
              {step === "otp"           && `Enter the code sent to ${phone}`}
              {step === "set-password"  && "Create your password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
                {error}
              </div>
            )}

            {step === "phone" && (
              <form onSubmit={handlePhoneContinue} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
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
                  Continue
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
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
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep("phone"); setError(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ← Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={busy}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Get SMS code instead"}
                  </button>
                </div>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {devCode && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    Dev mode — your code: <span className="font-mono font-bold text-base">{devCode}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="otp">6-digit code</Label>
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
                  {loading ? "Verifying..." : "Verify code"}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep("password"); setError(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={busy}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}

            {step === "set-password" && (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You're in! Set a password for future logins — you won't need to use a code every time.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || newPassword.length < 6}>
                  {loading ? "Saving..." : "Set password & continue"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">
              Demo access — one click
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.phone}
                  onClick={() => handleDemoLogin(acc.phone)}
                  disabled={busy}
                  className={`${acc.color} text-white text-xs font-medium rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {demoLoading === acc.phone ? "..." : acc.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Test numbers: <span className="font-mono">+7 999 000 000X</span> · password: <span className="font-mono font-medium">demo1234</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
