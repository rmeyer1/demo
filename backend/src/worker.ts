import "dotenv/config";
import { Worker } from "bullmq";
import { env } from "./config/env";
import { logger } from "./config/logger";
import {
  applyPlayerAction,
  ensureTableState,
  startHand,
  PlayerAction,
} from "./services/game.service";
import { getTableStateFromRedis } from "./services/table.service";
import {
  AutoStartJob,
  PlayerActionJob,
  TurnTimeoutJob,
} from "./queue/queues";
import { publishGameUpdate } from "./queue/pubsub";

const workerOptions = {
  connection: {
    url: env.REDIS_URL,
  },
};

logger.info("Starting BullMQ workers...");

// Player actions are serialized per table via group id set on the producer.
new Worker<PlayerActionJob>(
  "game-actions",
  async (job) => {
    const { tableId, userId, handId, action } = job.data;
    const result = await applyPlayerAction(tableId, userId, handId, action);

    if (result.seatIndex === undefined) {
      throw new Error("ACTION_RESULT_MISSING_SEAT_INDEX");
    }

    await publishGameUpdate({
      type: "ACTION_PROCESSED",
      tableId,
      handId,
      actionSummary: {
        seatIndex: result.seatIndex,
        action: action.action,
        amount: action.amount || 0,
        betting: result.betting,
        potTotal: result.potTotal,
      },
      events: result.events,
    });

    return {
      seatIndex: result.seatIndex,
      potTotal: result.potTotal,
    };
  },
  workerOptions
).on("failed", (job, err) => {
  logger.error(`Action job failed (${job?.id}):`, err);
});

// Durable turn timers
new Worker<TurnTimeoutJob>(
  "game-turn-timers",
  async (job) => {
    const { tableId, handId, seatIndex } = job.data;
    const state = await getTableStateFromRedis(tableId);
    if (!state || !state.currentHand || state.currentHand.handId !== handId) {
      return;
    }
    if (state.currentHand.toActSeatIndex !== seatIndex) {
      return;
    }

    const playerState = state.currentHand.playerStates.find(
      (p: any) => p.seatIndex === seatIndex
    );
    if (!playerState?.userId) {
      return;
    }

    const canCheck =
      (state.currentHand.callAmount || 0) === 0 ||
      playerState.currentBet === state.currentHand.betting?.currentBet;
    const timeoutAction: PlayerAction = {
      action: canCheck ? "CHECK" : "FOLD",
    };

    const result = await applyPlayerAction(
      tableId,
      playerState.userId,
      handId,
      timeoutAction
    );

    await publishGameUpdate({
      type: "TURN_TIMEOUT",
      tableId,
      handId,
      actionSummary: {
        seatIndex,
        action: timeoutAction.action,
        amount: timeoutAction.amount || 0,
        betting: result.betting,
        potTotal: result.potTotal,
      },
      events: result.events,
    });
  },
  workerOptions
).on("failed", (job, err) => {
  logger.error(`Turn-timeout job failed (${job?.id}):`, err);
});

// Auto-start next hand when table eligible
new Worker<AutoStartJob>(
  "game-auto-start",
  async (job) => {
    const { tableId } = job.data;
    const state = await ensureTableState(tableId);
    if (!state || state.currentHand) return;

    const eligible = state.seats.filter(
      (s: any) => s.userId && !s.isSittingOut && s.stack > 0
    );
    if (eligible.length < 2) return;

    const result = await startHand(tableId);

    await publishGameUpdate({
      type: "HAND_STARTED",
      tableId,
      handId: result.state.currentHand?.handId,
      events: result.events,
    });
  },
  workerOptions
).on("failed", (job, err) => {
  logger.error(`Auto-start job failed (${job?.id}):`, err);
});

logger.info("BullMQ workers ready.");
