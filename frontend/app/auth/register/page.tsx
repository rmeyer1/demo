"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const handleResend = async (targetEmail: string) => {
    setError("");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
    });
    if (resendError) {
      setError(resendError.message || "Couldn't resend verification email.");
    } else {
      setInfo("A new verification email has been sent. It may take a minute to arrive.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        const message = error.message || "Unable to sign up. Please try again.";
        if (message.toLowerCase().includes("registered")) {
          await handleResend(email);
          setAwaitingConfirmation(true);
          setInfo("We re-sent your confirmation email. Please check your inbox.");
        } else {
          setError(message);
        }
      } else {
        setAwaitingConfirmation(true);
        setInfo("Check your email for a confirmation link to finish signup.");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-3xl font-bold text-slate-50 mb-6 text-center">
          Sign Up
        </h1>
        {awaitingConfirmation ? (
          <div className="space-y-4 text-slate-200 text-center">
            <p>{info || "Check your email for a confirmation link to finish signup."}</p>
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm text-left">
                {error}
              </div>
            )}
            <Button
              type="button"
              className="w-full"
              disabled={loading}
              onClick={() => handleResend(email)}
            >
              Resend verification email
            </Button>
            <p className="text-sm text-slate-400">
              Used the wrong email?{" "}
              <button
                type="button"
                className="text-emerald-400 hover:underline"
                onClick={() => {
                  setAwaitingConfirmation(false);
                  setInfo("");
                  setError("");
                }}
              >
                Go back to edit
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-slate-400">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-emerald-400 hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
