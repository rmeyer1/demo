import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getDashboardSummary,
  getDashboardProgression,
} from "../../../src/services/metrics.service";

const mockPrisma = vi.hoisted(() => ({
  playerHand: {
    findMany: vi.fn(),
  },
  hand: {
    findMany: vi.fn(),
  },
}));

vi.mock("../../../src/db/prisma", () => ({ prisma: mockPrisma }));

const resetMocks = () => {
  for (const section of Object.values(mockPrisma)) {
    for (const fn of Object.values(section)) {
      fn.mockReset();
    }
  }
};

describe("metrics.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates summary metrics with average big blind", async () => {
    mockPrisma.playerHand.findMany.mockResolvedValue([
      {
        netChips: 100,
        vpipFlag: true,
        pfrFlag: true,
        sawShowdown: true,
        wonShowdown: true,
      },
      {
        netChips: -50,
        vpipFlag: false,
        pfrFlag: false,
        sawShowdown: true,
        wonShowdown: false,
      },
    ]);

    mockPrisma.hand.findMany.mockResolvedValue([
      { table: { bigBlind: 20 } },
      { table: { bigBlind: 40 } },
    ]);

    const summary = await getDashboardSummary("user-1", "lifetime");

    expect(summary.totalHands).toBe(2);
    expect(summary.netChips).toBe(50);
    expect(summary.vpip).toBeCloseTo(0.5);
    expect(summary.pfr).toBeCloseTo(0.5);
    expect(summary.showdownWinPct).toBeCloseTo(0.5);
    // netChips=50, avgBB=30, totalHands=2 -> (50/30/2)*100
    expect(summary.bbPer100).toBeCloseTo((50 / 30 / 2) * 100);
  });

  it("applies date filter for 7d range", async () => {
    const now = new Date("2024-01-10T12:00:00Z");
    vi.setSystemTime(now);

    mockPrisma.playerHand.findMany.mockResolvedValue([]);
    mockPrisma.hand.findMany.mockResolvedValue([]);

    await getDashboardSummary("user-1", "7d");

    expect(mockPrisma.playerHand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          hand: {
            completedAt: { gte: new Date("2024-01-03T12:00:00.000Z") },
          },
        },
      })
    );
  });

  it("builds progression grouped by hand number", async () => {
    mockPrisma.playerHand.findMany.mockResolvedValue([
      { netChips: 10, hand: { handNumber: "1" } },
      { netChips: -5, hand: { handNumber: "2" } },
    ]);

    const result = await getDashboardProgression("user-1", "lifetime", "hand");

    expect(mockPrisma.playerHand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          hand: expect.objectContaining({
            completedAt: undefined,
          }),
        }),
        include: { hand: { select: { handNumber: true } } },
        orderBy: { hand: { handNumber: "asc" } },
      })
    );
    expect(result.points).toEqual([
      { handNumber: 1, netChips: 10 },
      { handNumber: 2, netChips: 5 },
    ]);
  });

  it("builds progression grouped by day with running total", async () => {
    mockPrisma.playerHand.findMany.mockResolvedValue([
      { netChips: 50, hand: { completedAt: new Date("2024-01-01T00:00:00Z") } },
      { netChips: -10, hand: { completedAt: new Date("2024-01-02T00:00:00Z") } },
    ]);

    const result = await getDashboardProgression("user-1", "lifetime", "day");

    expect(result.points).toEqual([
      { date: "2024-01-01", netChips: 50 },
      { date: "2024-01-02", netChips: 40 },
    ]);
  });
});
