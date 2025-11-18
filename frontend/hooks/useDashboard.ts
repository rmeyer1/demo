"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type {
  DashboardSummary,
  DashboardProgression,
} from "@/lib/types";

export type TimeRange = "lifetime" | "7d" | "30d";

export function useDashboard(timeRange: TimeRange = "lifetime") {
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary", timeRange],
    queryFn: () =>
      apiClient.get<DashboardSummary>(
        `/api/dashboard/summary?range=${timeRange}`
      ),
  });

  const progressionQuery = useQuery({
    queryKey: ["dashboard", "progression", timeRange],
    queryFn: () =>
      apiClient.get<DashboardProgression[]>(
        `/api/dashboard/progression?range=${timeRange}`
      ),
  });

  return {
    summary: summaryQuery.data,
    progression: progressionQuery.data,
    isLoading: summaryQuery.isLoading || progressionQuery.isLoading,
    error: summaryQuery.error || progressionQuery.error,
  };
}


