import { prisma } from "../db/prisma";

export interface DashboardSummary {
  totalHands: number;
  netChips: number;
  vpip: number;
  pfr: number;
  showdownWinPct: number;
  bbPer100: number;
}

export interface ProgressionPoint {
  date?: string;
  handNumber?: number;
  netChips: number;
}

export async function getDashboardSummary(
  userId: string,
  range: "lifetime" | "7d" | "30d"
): Promise<DashboardSummary> {
  const dateFilter = getDateFilter(range);

  const playerHands = await prisma.playerHand.findMany({
    where: {
      userId,
      hand: {
        completedAt: dateFilter ? { gte: dateFilter } : undefined,
      },
    },
  });

  const totalHands = playerHands.length;
  const netChips = playerHands.reduce((sum, ph) => sum + ph.netChips, 0);
  const vpipHands = playerHands.filter((ph) => ph.vpipFlag).length;
  const pfrHands = playerHands.filter((ph) => ph.pfrFlag).length;
  const showdownHands = playerHands.filter((ph) => ph.sawShowdown).length;
  const wonShowdownHands = playerHands.filter((ph) => ph.wonShowdown).length;

  const vpip = totalHands > 0 ? vpipHands / totalHands : 0;
  const pfr = totalHands > 0 ? pfrHands / totalHands : 0;
  const showdownWinPct =
    showdownHands > 0 ? wonShowdownHands / showdownHands : 0;

  // Calculate BB/100 (big blinds per 100 hands)
  // We need to get average big blind from hands
  const handsWithBlinds = await prisma.hand.findMany({
    where: {
      playerHands: {
        some: {
          userId,
        },
      },
      completedAt: dateFilter ? { gte: dateFilter } : undefined,
    },
    include: {
      table: {
        select: {
          bigBlind: true,
        },
      },
    },
  });

  const avgBigBlind =
    handsWithBlinds.length > 0
      ? handsWithBlinds.reduce((sum, h) => sum + h.table.bigBlind, 0) /
        handsWithBlinds.length
      : 20; // Default fallback

  const bbPer100 = avgBigBlind > 0 ? (netChips / avgBigBlind / totalHands) * 100 : 0;

  return {
    totalHands,
    netChips,
    vpip,
    pfr,
    showdownWinPct,
    bbPer100,
  };
}

export async function getDashboardProgression(
  userId: string,
  range: "lifetime" | "7d" | "30d",
  groupBy: "day" | "hand"
): Promise<{ points: ProgressionPoint[] }> {
  const dateFilter = getDateFilter(range);

  if (groupBy === "hand") {
    const playerHands = await prisma.playerHand.findMany({
      where: {
        userId,
        hand: {
          completedAt: dateFilter ? { gte: dateFilter } : undefined,
        },
      },
      include: {
        hand: {
          select: {
            handNumber: true,
          },
        },
      },
      orderBy: {
        hand: {
          handNumber: "asc",
        },
      },
    });

    let runningTotal = 0;
    const points: ProgressionPoint[] = playerHands.map((ph) => {
      runningTotal += ph.netChips;
      return {
        handNumber: Number(ph.hand.handNumber),
        netChips: runningTotal,
      };
    });

    return { points };
  } else {
    // Group by day
    const playerHands = await prisma.playerHand.findMany({
      where: {
        userId,
        hand: {
          completedAt: dateFilter ? { gte: dateFilter } : undefined,
        },
      },
      include: {
        hand: {
          select: {
            completedAt: true,
          },
        },
      },
    });

    // Group by date
    const byDate = new Map<string, number>();
    for (const ph of playerHands) {
      if (ph.hand.completedAt) {
        const date = ph.hand.completedAt.toISOString().split("T")[0];
        byDate.set(date, (byDate.get(date) || 0) + ph.netChips);
      }
    }

    const points: ProgressionPoint[] = Array.from(byDate.entries())
      .map(([date, netChips]) => ({
        date,
        netChips,
      }))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    // Calculate running total
    let runningTotal = 0;
    return {
      points: points.map((p) => {
        runningTotal += p.netChips;
        return {
          date: p.date,
          netChips: runningTotal,
        };
      }),
    };
  }
}

function getDateFilter(range: "lifetime" | "7d" | "30d"): Date | null {
  if (range === "lifetime") {
    return null;
  }

  const now = new Date();
  const days = range === "7d" ? 7 : 30;
  const filterDate = new Date(now);
  filterDate.setDate(filterDate.getDate() - days);
  return filterDate;
}

