"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/apiClient";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ResetRequestPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiClient.post("/api/auth/password-reset/request", { email });
      setSubmitted(true);
    } catch {
      setError("Unable to send reset email right now. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-3xl font-bold text-slate-50 mb-6 text-center">Reset your password</h1>
        {submitted ? (
          <div className="space-y-4 text-slate-200 text-center">
            <p>Check your email for a link to reset your password.</p>
            <p className="text-sm text-slate-400">
              If you don&apos;t see it in a few minutes, check your spam folder or try again.
            </p>
            <Link href="/auth/login" className="text-emerald-400 hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-slate-400">
              Remembered your password?{" "}
              <Link href="/auth/login" className="text-emerald-400 hover:underline">
                Go back to login
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
