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
  actionQueue,
  autoStartQueue,
  turnTimeoutQueue,
} from "./queue/queues";
import { publishGameUpdate } from "./queue/pubsub";
import { startQueueMonitoring } from "./queue/monitor";

const workerOptions = {
  connection: {
    url: env.REDIS_URL,
  },
};

logger.info("Starting BullMQ workers...");

startQueueMonitoring([actionQueue, turnTimeoutQueue, autoStartQueue]);

const workers: Worker[] = [];

// Player actions are serialized per table via group id set on the producer.
const actionWorker = new Worker<PlayerActionJob>(
  "game-actions",
  async (job) => {
    const { tableId, userId, handId, action } = job.data;
    let result;
    try {
      result = await applyPlayerAction(tableId, userId, handId, action);
    } catch (err: any) {
      logger.error("Action processing failed", err);
      await publishGameUpdate({
        type: "ERROR",
        tableId,
        handId,
        userId,
        errorCode: err?.message || "ACTION_FAILED",
        errorMessage: "Your action could not be processed. Please try again.",
      });
      throw err;
    }

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
);
actionWorker.on("failed", (job, err) => {
  logger.error(`Action job failed (${job?.id}):`, err);
});
workers.push(actionWorker);

// Durable turn timers
const turnWorker = new Worker<TurnTimeoutJob>(
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
);
turnWorker.on("failed", (job, err) => {
  logger.error(`Turn-timeout job failed (${job?.id}):`, err);
});
workers.push(turnWorker);

// Auto-start next hand when table eligible
const autoStartWorker = new Worker<AutoStartJob>(
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
);
autoStartWorker.on("failed", (job, err) => {
  logger.error(`Auto-start job failed (${job?.id}):`, err);
});
workers.push(autoStartWorker);

logger.info("BullMQ workers ready.");

async function shutdown() {
  logger.info("Shutting down workers...");
  await Promise.allSettled(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
