import { prisma } from "../db/prisma";
import { redis } from "../db/redis";
import {
  getTableStateFromRedis,
  setTableStateInRedis,
  deleteTableStateFromRedis,
} from "./table.service";
import * as engine from "../engine";
import { cardToString } from "../engine/cards";
import { logger } from "../config/logger";

export interface PlayerAction {
  action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
  amount?: number;
}

export async function applyPlayerAction(
  tableId: string,
  userId: string,
  handId: string,
  action: PlayerAction
) {
  // Load table state from Redis
  let tableState = await getTableStateFromRedis(tableId);

  if (!tableState) {
    // If no state in Redis, try to initialize from DB
    tableState = await initializeTableStateFromDb(tableId);
    if (!tableState) {
      throw new Error("TABLE_STATE_NOT_FOUND");
    }
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

  return result;
}

export async function getPublicTableView(
  tableId: string,
  userId: string
): Promise<any> {
  const tableState = await getTableStateFromRedis(tableId);

  if (!tableState) {
    return null;
  }

  return engine.getPublicTableView(tableState, userId);
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
        vpipFlag: p.totalBet > 0,
        pfrFlag: handState.betting?.lastAggressorSeatIndex === p.seatIndex,
        sawShowdown: Boolean(handResult),
        wonShowdown: wonAmount > 0,
        finalHandRank: winner?.handRank || null,
      };
    });

  await prisma.$transaction(async (tx: any) => {
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
  });
}

function cloneHand(hand: any) {
  return JSON.parse(JSON.stringify(hand));
}
