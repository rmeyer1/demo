import { redis } from "../db/redis";

export const GAME_UPDATE_CHANNEL = "game:updates";

export interface GameUpdateMessage {
  type: "ACTION_PROCESSED" | "TURN_TIMEOUT" | "HAND_STARTED";
  tableId: string;
  handId?: string;
  // Summary of the applied action (used for ACTION_TAKEN broadcast)
  actionSummary?: {
    seatIndex: number;
    action: string;
    amount: number;
    betting?: any;
    potTotal?: number;
  };
  events?: any[];
}

export async function publishGameUpdate(message: GameUpdateMessage) {
  await redis.publish(GAME_UPDATE_CHANNEL, JSON.stringify(message));
}
