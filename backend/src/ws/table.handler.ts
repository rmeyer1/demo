import { Server, Socket } from "socket.io";
import { ErrorMessage } from "./types";
import { getTableById } from "../services/table.service";
import { sitDown, standUp } from "../services/table.service";
import { applyPlayerAction, getPublicTableView, ensureTableState } from "../services/game.service";
import { logger } from "../config/logger";
import {
  JoinTableInput,
  LeaveTableInput,
  PlayerActionInput,
  SitDownInput,
  StandUpInput,
} from "./schemas";
import { checkRateLimit } from "../utils/rateLimiter";
import { deleteTableStateFromRedis } from "../services/table.service";

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
    const result = await sitDown(msg.tableId, userId, msg.seatIndex, msg.buyInAmount);

    // Refresh cached table state so seat changes are reflected in engine/public views
    await deleteTableStateFromRedis(msg.tableId);
    await ensureTableState(msg.tableId);

    // Broadcast updated table state to all in the room
    const tableView = await getPublicTableView(msg.tableId, userId);
    io.to(`table:${msg.tableId}`).emit("TABLE_STATE", {
      tableId: msg.tableId,
      state: tableView,
    });
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
    await standUp(msg.tableId, userId);

    await deleteTableStateFromRedis(msg.tableId);
    await ensureTableState(msg.tableId);

    // Broadcast updated table state
    const tableView = await getPublicTableView(msg.tableId, userId);
    io.to(`table:${msg.tableId}`).emit("TABLE_STATE", {
      tableId: msg.tableId,
      state: tableView,
    });
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

    const result = await applyPlayerAction(msg.tableId, userId, msg.handId, {
      action: msg.action,
      amount: msg.amount,
    });

    // Broadcast action taken
    io.to(`table:${msg.tableId}`).emit("ACTION_TAKEN", {
      tableId: msg.tableId,
      handId: msg.handId,
      seatIndex: result.seatIndex,
      action: msg.action,
      amount: msg.amount || 0,
      betting: result.betting,
      potTotal: result.potTotal,
    });

    // Broadcast updated table state
    for (const event of result.events) {
      if (event.type === "HOLE_CARDS") {
        // Send hole cards only to the specific player
        io.to(`user:${event.userId}`).emit("HOLE_CARDS", {
          tableId: msg.tableId,
          handId: msg.handId,
          cards: event.cards,
        });
      } else if (event.type === "HAND_RESULT") {
        io.to(`table:${msg.tableId}`).emit("HAND_RESULT", {
          tableId: msg.tableId,
          handId: msg.handId,
          results: event.results,
        });
      }
    }

    // Send updated table state to all
    const tableView = await getPublicTableView(msg.tableId, userId);
    io.to(`table:${msg.tableId}`).emit("TABLE_STATE", {
      tableId: msg.tableId,
      state: tableView,
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
