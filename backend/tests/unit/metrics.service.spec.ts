import { describe, it, expect } from "vitest";
import { calculateDashboardSummary } from "../../src/services/metrics.service";

describe("calculateDashboardSummary", () => {
  it("computes aggregates and bb/100 with sample data", () => {
    const playerHands = [
      { netChips: 50, vpipFlag: true, pfrFlag: true, sawShowdown: true, wonShowdown: true },
      { netChips: -20, vpipFlag: true, pfrFlag: false, sawShowdown: true, wonShowdown: false },
      { netChips: 10, vpipFlag: false, pfrFlag: false, sawShowdown: false, wonShowdown: false },
    ];

    const handsWithBlinds = [
      { table: { bigBlind: 10 } },
      { table: { bigBlind: 20 } },
      { table: { bigBlind: 20 } },
    ];

    const summary = calculateDashboardSummary(playerHands, handsWithBlinds);

    expect(summary.totalHands).toBe(3);
    expect(summary.netChips).toBe(40);
    expect(summary.vpip).toBeCloseTo(2 / 3);
    expect(summary.pfr).toBeCloseTo(1 / 3);
    expect(summary.showdownWinPct).toBeCloseTo(1 / 2);
    expect(summary.bbPer100).toBeCloseTo(80, 5); // 40 / 16.666 / 3 * 100 ≈ 80
  });

  it("handles empty input gracefully", () => {
    const summary = calculateDashboardSummary([], []);
    expect(summary).toEqual({
      totalHands: 0,
      netChips: 0,
      vpip: 0,
      pfr: 0,
      showdownWinPct: 0,
      bbPer100: 0,
    });
  });
});
