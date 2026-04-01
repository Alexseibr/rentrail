import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "superadmin@platform.demo", color: "bg-violet-600 hover:bg-violet-700" },
  { label: "Platform Admin", email: "platformadmin@platform.demo", color: "bg-blue-600 hover:bg-blue-700" },
  { label: "Support", email: "support@platform.demo", color: "bg-sky-600 hover:bg-sky-700" },
  { label: "Finance", email: "finance@platform.demo", color: "bg-emerald-600 hover:bg-emerald-700" },
];

const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError("");
    setDemoLoading(demoEmail);
    try {
      await login(demoEmail, DEMO_PASSWORD);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Platform Admin</CardTitle>
            <CardDescription>Sign in with your platform credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !!demoLoading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
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
                  key={acc.email}
                  onClick={() => handleDemoLogin(acc.email)}
                  disabled={!!demoLoading || loading}
                  className={`${acc.color} text-white text-xs font-medium rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {demoLoading === acc.email ? "..." : acc.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Password for all: <span className="font-mono font-medium">demo1234</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
