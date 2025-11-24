import { Queue } from "bullmq";
import { env } from "../config/env";
import { PlayerAction } from "../services/game.service";

const baseOptions = {
  connection: {
    url: env.REDIS_URL,
  },
};

export interface PlayerActionJob {
  tableId: string;
  userId: string;
  handId: string;
  action: PlayerAction;
}

export interface TurnTimeoutJob {
  tableId: string;
  handId: string;
  seatIndex: number;
}

export interface AutoStartJob {
  tableId: string;
}

// Note: BullMQ queue names cannot contain ":".
export const actionQueue = new Queue<PlayerActionJob>("game-actions", baseOptions);
export const turnTimeoutQueue = new Queue<TurnTimeoutJob>("game-turn-timers", baseOptions);
export const autoStartQueue = new Queue<AutoStartJob>("game-auto-start", baseOptions);

export async function enqueuePlayerAction(job: PlayerActionJob) {
  await actionQueue.add("player-action", job, {
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

export async function enqueueTurnTimeout(job: TurnTimeoutJob, delayMs: number) {
  const jobId = `${job.tableId}|${job.handId}|${job.seatIndex}`;
  await turnTimeoutQueue.add("turn-timeout", job, {
    delay: delayMs,
    removeOnComplete: 200,
    removeOnFail: 500,
    jobId,
  });
}

export async function enqueueAutoStart(job: AutoStartJob, delayMs: number) {
  const jobId = `auto-start|${job.tableId}`;
  await autoStartQueue.add("auto-start", job, {
    delay: delayMs,
    removeOnComplete: 200,
    removeOnFail: 500,
    jobId,
  });
}
