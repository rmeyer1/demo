"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ResetConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const exchange = async () => {
      if (!code) {
        setError("Missing or invalid reset link.");
        return;
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError("This reset link is invalid or expired.");
      } else {
        setSessionReady(true);
      }
    };
    exchange();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Could not update password. Please try again.");
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-3xl font-bold text-slate-50 mb-6 text-center">Set a new password</h1>
        {success ? (
          <div className="space-y-3 text-slate-200 text-center">
            <p>Password updated. Redirecting to login...</p>
            <Link href="/auth/login" className="text-emerald-400 hover:underline">
              Go to login now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || !sessionReady}
              minLength={6}
              required
            />
            <Input
              type="password"
              label="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || !sessionReady}
              minLength={6}
              required
            />
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
