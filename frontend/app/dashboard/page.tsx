"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard, type TimeRange } from "@/hooks/useDashboard";
import { StatsSummary } from "@/components/dashboard/StatsSummary";
import { NetChipsChart } from "@/components/dashboard/NetChipsChart";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("lifetime");
  const { summary, progression, isLoading } = useDashboard(timeRange);

  if (authLoading) {
    return (
      <div className="text-center text-slate-400">Loading...</div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-50 mb-8">Dashboard</h1>

      <div className="mb-6 flex gap-2 border-b border-slate-700">
        {(["lifetime", "7d", "30d"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-6 py-3 font-medium transition-colors ${
              timeRange === range
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {range === "lifetime"
              ? "Lifetime"
              : range === "7d"
              ? "Last 7 Days"
              : "Last 30 Days"}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        {isLoading ? (
          <div className="text-center text-slate-400">Loading stats...</div>
        ) : summary ? (
          <>
            <StatsSummary summary={summary} />
            {progression && <NetChipsChart progression={progression} />}
          </>
        ) : (
          <div className="text-center text-slate-400">
            No data available yet. Play some hands to see your stats!
          </div>
        )}
      </div>
    </div>
  );
}

