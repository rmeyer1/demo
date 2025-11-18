"use client";

import { Card } from "@/components/ui/Card";
import type { DashboardSummary } from "@/lib/types";

interface StatsSummaryProps {
  summary: DashboardSummary;
}

export function StatsSummary({ summary }: StatsSummaryProps) {
  const stats = [
    { label: "Total Hands", value: summary.totalHands },
    { label: "Net Chips", value: summary.netChips },
    { label: "VPIP", value: `${summary.vpip.toFixed(1)}%` },
    { label: "PFR", value: `${summary.pfr.toFixed(1)}%` },
    { label: "Showdown Win Rate", value: `${summary.showdownWinRate.toFixed(1)}%` },
    { label: "BB/100", value: summary.bbPer100.toFixed(2) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <div className="text-sm text-slate-400 mb-1">{stat.label}</div>
          <div className="text-2xl font-bold text-slate-50">{stat.value}</div>
        </Card>
      ))}
    </div>
  );
}


