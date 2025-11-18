"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

export function Header() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-700">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-emerald-400">
          Texas Hold&apos;em
        </Link>
        <nav className="flex items-center gap-4">
          {loading ? (
            <div className="text-slate-400">Loading...</div>
          ) : user ? (
            <>
              <Link
                href="/lobby"
                className="text-slate-300 hover:text-emerald-400 transition-colors"
              >
                Lobby
              </Link>
              <Link
                href="/dashboard"
                className="text-slate-300 hover:text-emerald-400 transition-colors"
              >
                Dashboard
              </Link>
              <span className="text-slate-400">
                {user.displayName || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Log In
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}


