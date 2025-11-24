import { prisma } from "../db/prisma";
import { Prisma } from "@prisma/client";
import {
  getTableStateFromRedis,
  setTableStateInRedis,
  deleteTableStateFromRedis,
} from "./table.service";
import * as engine from "../engine";
import { cardToString } from "../engine/cards";
import { EngineResult } from "../engine/types";
import { logger } from "../config/logger";
import { enqueueAutoStart, enqueueTurnTimeout } from "../queue/queues";

export interface PlayerAction {
  action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
  amount?: number;
}

export type ApplyPlayerActionResult = EngineResult | { stale: true };

export async function applyPlayerAction(
  tableId: string,
  userId: string,
  handId: string,
  action: PlayerAction
): Promise<ApplyPlayerActionResult> {
  // Load table state from Redis
  let tableState = await getTableStateFromRedis(tableId);

  if (!tableState) {
    // If no state in Redis, try to initialize from DB
    tableState = await initializeTableStateFromDb(tableId);
    if (!tableState) {
      throw new Error("TABLE_STATE_NOT_FOUND");
    }
  }

  // Reject stale actions that target a different hand than the one currently active.
  if (!tableState.currentHand || tableState.currentHand.handId !== handId) {
    logger.warn("Stale action rejected", {
      tableId,
      userId,
      handId,
      currentHandId: tableState.currentHand?.handId,
    });
    return { stale: true as const };
  }

  // Verify it's the player's turn
  const seat = tableState.seats.find((s: any) => s.userId === userId);
  if (!seat || !tableState.currentHand || seat.seatIndex !== tableState.currentHand.toActSeatIndex) {
    throw new Error("NOT_YOUR_TURN");
  }

  // Apply action via engine
  let result = engine.applyPlayerAction(tableState, seat.seatIndex, action);
  let handSnapshot = result.state.currentHand ? cloneHand(result.state.currentHand) : null;

  // Check if we can advance the game (betting round complete, etc.)
  let advanceResult = engine.advanceIfReady(result.state);
  while (advanceResult) {
    // Merge events from advancement
    result.events.push(...advanceResult.events);
    result.state = advanceResult.state;
    if (advanceResult.state.currentHand) {
      handSnapshot = cloneHand(advanceResult.state.currentHand);
    }
    
    // If hand completed, break
    if (advanceResult.events.some((e: any) => e.type === "HAND_COMPLETE")) {
      break;
    }
    
    // Continue checking for further advancements
    advanceResult = engine.advanceIfReady(result.state);
  }

  // Save updated state to Redis
  await setTableStateInRedis(tableId, result.state);

  // If hand completed, persist to DB
  if (result.events.some((e: any) => e.type === "HAND_COMPLETE")) {
    await persistHandToDb(tableId, handSnapshot, result.events, result.state.seats);
    // Schedule next hand if eligible
    scheduleAutoStart(tableId);
  } else if (result.state.currentHand?.toActSeatIndex !== undefined) {
    scheduleTurnTimeout(
      tableId,
      result.state.currentHand.handId,
      result.state.currentHand.toActSeatIndex
    );
  }

  return result;
}

export async function startHand(tableId: string) {
  // Load table state
  let tableState = await getTableStateFromRedis(tableId);

  if (!tableState) {
    tableState = await initializeTableStateFromDb(tableId);
    if (!tableState) {
      throw new Error("TABLE_STATE_NOT_FOUND");
    }
  }

  // Start hand via engine
  const result = engine.startHand(tableState);

  // Save state
  await setTableStateInRedis(tableId, result.state);

  if (result.state.currentHand?.toActSeatIndex !== undefined) {
    scheduleTurnTimeout(
      tableId,
      result.state.currentHand.handId,
      result.state.currentHand.toActSeatIndex
    );
  }

  return result;
}

export async function ensureTableState(tableId: string): Promise<any | null> {
  let tableState = await getTableStateFromRedis(tableId);
  if (!tableState) {
    tableState = await initializeTableStateFromDb(tableId);
    if (tableState) {
      await setTableStateInRedis(tableId, tableState);
    }
  }
  return tableState;
}

export async function getPublicTableView(
  tableId: string,
  userId: string
): Promise<any> {
  const tableState = await ensureTableState(tableId);

  if (!tableState) {
    return null;
  }

  return engine.getPublicTableView(tableState, userId);
}

export async function startGame(tableId: string, hostUserId: string) {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { hostUserId: true, status: true },
  });

  if (!table) {
    throw new Error("TABLE_NOT_FOUND");
  }
  if (table.hostUserId !== hostUserId) {
    throw new Error("NOT_TABLE_HOST");
  }

  // Ensure state exists
  await ensureTableState(tableId);

  // Mark table as in-game
  if (table.status !== "IN_GAME") {
    await prisma.table.update({ where: { id: tableId }, data: { status: "IN_GAME" } });
  }

  // Start first hand
  return startHand(tableId);
}

// --- Auto-start orchestration ---
const AUTO_START_DELAY_MS = 2000;
const TURN_TIMEOUT_MS = 15000; // TODO: make configurable per table/game

export async function scheduleAutoStart(tableId: string, delayMs = AUTO_START_DELAY_MS) {
  // JobId prevents duplicate queued auto-starts; worker will validate eligibility.
  await enqueueAutoStart({ tableId }, delayMs);
}

export function clearAutoStart(tableId: string) {
  // No-op with queued timers; removal not required because jobId de-duplicates.
  return;
}

export async function scheduleTurnTimeout(
  tableId: string,
  handId: string,
  toActSeatIndex: number,
  timeoutMs = TURN_TIMEOUT_MS
) {
  await enqueueTurnTimeout(
    { tableId, handId, seatIndex: toActSeatIndex },
    timeoutMs
  );
}

async function initializeTableStateFromDb(tableId: string): Promise<any | null> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      seats: {
        include: {
          user: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: {
          seatIndex: "asc",
        },
      },
    },
  });

  if (!table) {
    return null;
  }

  // Convert DB state to engine state format
  return engine.initTableState({
    tableId: table.id,
    maxPlayers: table.maxPlayers,
    smallBlind: table.smallBlind,
    bigBlind: table.bigBlind,
    seats: table.seats.map((seat: any) => ({
      seatIndex: seat.seatIndex,
      userId: seat.userId,
      displayName: seat.user?.displayName || "Unknown",
      stack: seat.stack,
      isSittingOut: seat.isSittingOut,
    })),
  });
}

export async function persistHandToDb(
  tableId: string,
  handState: any | null,
  events: any[],
  seats: any[]
): Promise<void> {
  if (!handState) {
    logger.warn("persistHandToDb called without handState");
    return;
  }

  const handResult = events.find((e) => e.type === "HAND_RESULT");
  const finalStacks =
    handResult?.finalStacks ||
    seats.map((s: any) => ({
      seatIndex: s.seatIndex,
      stack: s.stack,
    }));

  const seatUserMap = new Map<number, string>();
  for (const seat of seats) {
    if (seat.userId) {
      seatUserMap.set(seat.seatIndex, seat.userId);
    }
  }

  const handActions = events
    .filter((e) => e.type === "PLAYER_ACTION_APPLIED")
    .map((e) => ({
      seatIndex: e.seatIndex,
      actionType: e.action,
      street: e.betting?.street || handState.street,
      amount: e.amount || 0,
      userId: seatUserMap.get(e.seatIndex),
    }))
    .filter((a) => a.userId);

  // Derive VPIP / PFR from preflop actions
  const vpipSeats = new Set<number>();
  const pfrSeats = new Set<number>();
  for (const action of handActions) {
    if (action.street === "PREFLOP") {
      if (["CALL", "BET", "RAISE", "ALL_IN"].includes(action.actionType)) {
        vpipSeats.add(action.seatIndex);
      }
      if (["BET", "RAISE", "ALL_IN"].includes(action.actionType)) {
        pfrSeats.add(action.seatIndex);
      }
    }
  }

  const playerHands = handState.playerStates
    .filter((p: any) => seatUserMap.has(p.seatIndex))
    .map((p: any) => {
      const winner = handResult?.winners?.find((w: any) => w.seatIndex === p.seatIndex);
      const finalStack = finalStacks.find((fs: any) => fs.seatIndex === p.seatIndex)?.stack;
      const wonAmount = winner?.wonAmount || 0;
      const netChips = wonAmount - p.totalBet;
      const holeCards = Array.isArray(p.holeCards)
        ? p.holeCards
            .filter(Boolean)
            .map((c: any) => cardToString(c))
        : [];

      return {
        seatIndex: p.seatIndex,
        userId: seatUserMap.get(p.seatIndex)!,
        holeCards,
        netChips,
        vpipFlag: vpipSeats.has(p.seatIndex),
        pfrFlag: pfrSeats.has(p.seatIndex),
        sawShowdown: Boolean(handResult),
        wonShowdown: wonAmount > 0,
        finalHandRank: winner?.handRank || null,
      };
    });

  await prisma
    .$transaction(async (tx: any) => {
      const existingHand = await tx.hand.findUnique({
        where: {
          tableId_handNumber: {
            tableId,
            handNumber: BigInt(handState.handNumber),
        },
      },
    });

    if (existingHand) {
      logger.warn("Hand already persisted; skipping duplicate", {
        tableId,
        handNumber: handState.handNumber,
      });
      for (const fs of finalStacks) {
        await tx.seat.updateMany({
          where: {
            tableId,
            seatIndex: fs.seatIndex,
          },
          data: {
            stack: fs.stack,
          },
        });
      }
      return;
    }

    const handRecord = await tx.hand.create({
      data: {
        tableId,
        handNumber: BigInt(handState.handNumber),
        dealerSeatIndex: handState.dealerSeatIndex,
        smallBlindSeatIndex: handState.smallBlindSeatIndex,
        bigBlindSeatIndex: handState.bigBlindSeatIndex,
        communityCards: handState.communityCards?.map((c: any) => cardToString(c)) || [],
        status: "COMPLETE",
        completedAt: new Date(),
      },
    });

    if (playerHands.length > 0) {
      await tx.playerHand.createMany({
        data: playerHands.map((ph: any) => ({
          handId: handRecord.id,
          tableId,
          userId: ph.userId,
          seatIndex: ph.seatIndex,
          holeCards: ph.holeCards,
          netChips: ph.netChips,
          vpipFlag: ph.vpipFlag,
          pfrFlag: ph.pfrFlag,
          sawShowdown: ph.sawShowdown,
          wonShowdown: ph.wonShowdown,
          finalHandRank: ph.finalHandRank,
        })),
      });
    }

    if (handActions.length > 0) {
      await tx.handAction.createMany({
        data: handActions.map((ha) => ({
          handId: handRecord.id,
          tableId,
          userId: ha.userId!,
          seatIndex: ha.seatIndex,
          street: ha.street,
          actionType: ha.actionType,
          amount: ha.amount,
        })),
      });
    }

    for (const fs of finalStacks) {
      await tx.seat.updateMany({
        where: {
          tableId,
          seatIndex: fs.seatIndex,
        },
        data: {
          stack: fs.stack,
        },
      });
    }
    })
    .catch((err: any) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        logger.warn("Hand persistence duplicate detected, skipping", {
          tableId,
          handNumber: handState.handNumber,
        });
        return;
      }
      throw err;
    });
}

function cloneHand(hand: any) {
  return JSON.parse(JSON.stringify(hand));
}
