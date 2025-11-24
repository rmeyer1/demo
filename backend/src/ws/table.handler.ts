import { Server, Socket } from "socket.io";
import { ErrorMessage } from "./types";
import {
  getTableById,
  activateSeat,
  deleteTableStateFromRedis,
  sitDown,
  standUp,
  setTableStateInRedis,
} from "../services/table.service";
import { getPublicTableView, ensureTableState } from "../services/game.service";
import { logger } from "../config/logger";
import {
  JoinTableInput,
  LeaveTableInput,
  PlayerActionInput,
  SitDownInput,
  StandUpInput,
} from "./schemas";
import { checkRateLimit } from "../utils/rateLimiter";
import { enqueuePlayerAction } from "../queue/queues";

async function handleJoinTable(
  io: Server,
  socket: Socket,
  msg: JoinTableInput,
  userId: string
): Promise<void> {
  try {
    const table = await getTableById(msg.tableId);

    if (!table) {
      sendError(socket, "TABLE_NOT_FOUND", "Table does not exist.");
      return;
    }

    // Check if user is allowed (host or has a seat or holds valid invite)
    const isHost = table.hostUserId === userId;
    const hasSeat = table.seats.some((s) => s.userId === userId);
    const hasValidInvite = msg.inviteCode && msg.inviteCode === table.inviteCode;

    if (!isHost && !hasSeat && !hasValidInvite) {
      sendError(socket, "NOT_IN_TABLE", "You are not a member of this table.");
      return;
    }

    // If the user already has a seat but was marked sitting out (e.g., after reconnect), reactivate it.
    if (hasSeat) {
      const reactivated = await activateSeat(msg.tableId, userId);
      if (reactivated) {
        const state = await ensureTableState(msg.tableId);
        if (state?.currentHand) {
          const seatIdx = state.seats.findIndex((s: any) => s.userId === userId);
          if (seatIdx >= 0) {
            state.seats[seatIdx].isSittingOut = false;
            await setTableStateInRedis(msg.tableId, state);
          }
        } else {
          await deleteTableStateFromRedis(msg.tableId);
          await ensureTableState(msg.tableId);
        }
        await broadcastTableState(io, msg.tableId);
      }
    }

    // Join the table room
    socket.join(`table:${msg.tableId}`);

    // Send confirmation
    socket.emit("TABLE_JOINED", {
      tableId: msg.tableId,
    });

    // Send current table state
    const tableView = await getPublicTableView(msg.tableId, userId);
    if (tableView) {
      socket.emit("TABLE_STATE", {
        tableId: msg.tableId,
        state: tableView,
      });
    }
  } catch (error) {
    logger.error("Error handling JOIN_TABLE:", error);
    sendError(socket, "INTERNAL_ERROR", "Failed to join table.");
  }
}

async function handleLeaveTable(
  io: Server,
  socket: Socket,
  msg: LeaveTableInput
): Promise<void> {
  socket.leave(`table:${msg.tableId}`);
}

async function handleSitDown(
  io: Server,
  socket: Socket,
  msg: SitDownInput,
  userId: string
): Promise<void> {
  try {
    const state = await ensureTableState(msg.tableId);
    if (state?.currentHand) {
      sendError(socket, "HAND_IN_PROGRESS", "Cannot sit down during an active hand.");
      return;
    }

    await sitDown(msg.tableId, userId, msg.seatIndex, msg.buyInAmount);

    await deleteTableStateFromRedis(msg.tableId);
    await ensureTableState(msg.tableId);
    await broadcastTableState(io, msg.tableId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    sendError(socket, errorMessage, errorMessage);
  }
}

async function handleStandUp(
  io: Server,
  socket: Socket,
  msg: StandUpInput,
  userId: string
): Promise<void> {
  try {
    const state = await ensureTableState(msg.tableId);
    if (state?.currentHand) {
      const playerInHand = state.currentHand.playerStates.find((p: any) => p.userId === userId);
      if (playerInHand) {
        sendError(socket, "HAND_IN_PROGRESS", "Cannot stand up during an active hand.");
        return;
      }
    }

    await standUp(msg.tableId, userId);

    await deleteTableStateFromRedis(msg.tableId);
    await ensureTableState(msg.tableId);
    await broadcastTableState(io, msg.tableId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    sendError(socket, errorMessage, errorMessage);
  }
}

async function handlePlayerAction(
  io: Server,
  socket: Socket,
  msg: PlayerActionInput,
  userId: string
): Promise<void> {
  try {
    const rlKey = `action:${userId}:${msg.tableId}`;
    if (
      !checkRateLimit(rlKey, {
        windowMs: Number(process.env.ACTION_RATE_LIMIT_WINDOW_MS || 3000),
        max: Number(process.env.ACTION_RATE_LIMIT_MAX || 8),
      })
    ) {
      sendError(socket, "ACTION_RATE_LIMIT", "Too many actions. Please slow down.");
      return;
    }

    await enqueuePlayerAction({
      tableId: msg.tableId,
      userId,
      handId: msg.handId,
      action: { action: msg.action, amount: msg.amount },
    });

    // Ack receipt; actual processing/broadcast handled by worker via pub/sub.
    socket.emit("ACTION_ENQUEUED", {
      tableId: msg.tableId,
      handId: msg.handId,
      action: msg.action,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    sendError(socket, errorMessage, errorMessage);
  }
}

function sendError(socket: Socket, code: string, message: string): void {
  socket.emit("ERROR", {
    code,
    message,
  } as ErrorMessage);
}

export const tableHandlers = {
  handleJoinTable,
  handleLeaveTable,
  handleSitDown,
  handleStandUp,
  handlePlayerAction,
};

export async function broadcastTableState(io: Server, tableId: string) {
  const sockets = await io.in(`table:${tableId}`).fetchSockets();
  if (!sockets.length) return;

  await ensureTableState(tableId);

  for (const s of sockets) {
    const userId = (s as any).userId as string | undefined;
    if (!userId) continue;
    const view = await getPublicTableView(tableId, userId);
    if (view) {
      s.emit("TABLE_STATE", {
        tableId,
        state: view,
      });
    }
  }
}
