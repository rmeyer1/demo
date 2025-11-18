"use client";

import { Card } from "@/components/ui/Card";
import type { DashboardProgression } from "@/lib/types";

interface NetChipsChartProps {
  progression: DashboardProgression[];
}

export function NetChipsChart({ progression }: NetChipsChartProps) {
  if (progression.length === 0) {
    return (
      <Card>
        <p className="text-center text-slate-400">No data available</p>
      </Card>
    );
  }

  const maxValue = Math.max(...progression.map((p) => p.netChips));
  const minValue = Math.min(...progression.map((p) => p.netChips));
  const range = maxValue - minValue || 1;

  return (
    <Card>
      <h3 className="text-xl font-semibold text-slate-50 mb-4">
        Net Chips Progression
      </h3>
      <div className="h-64 flex items-end gap-2">
        {progression.map((point, index) => {
          const height = ((point.netChips - minValue) / range) * 100;
          const isPositive = point.netChips >= 0;

          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center"
              title={`${new Date(point.date).toLocaleDateString()}: ${point.netChips}`}
            >
              <div
                className={`w-full rounded-t ${
                  isPositive ? "bg-emerald-600" : "bg-red-600"
                }`}
                style={{ height: `${Math.max(height, 5)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-between text-xs text-slate-400">
        <span>
          {new Date(progression[0]?.date).toLocaleDateString()}
        </span>
        <span>
          {new Date(progression[progression.length - 1]?.date).toLocaleDateString()}
        </span>
      </div>
    </Card>
  );
}


