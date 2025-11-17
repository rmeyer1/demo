import { Server, Socket } from "socket.io";
import {
  JoinTableMessage,
  LeaveTableMessage,
  SitDownMessage,
  StandUpMessage,
  PlayerActionMessage,
  ErrorMessage,
} from "./types";
import { getTableById } from "../services/table.service";
import { sitDown, standUp } from "../services/table.service";
import { applyPlayerAction, getPublicTableView } from "../services/game.service";
import { logger } from "../config/logger";

export async function handleTableMessage(
  io: Server,
  socket: Socket,
  msg: any
): Promise<void> {
  const userId = (socket as any).userId;

  switch (msg.type) {
    case "JOIN_TABLE":
      await handleJoinTable(io, socket, msg as JoinTableMessage, userId);
      break;
    case "LEAVE_TABLE":
      await handleLeaveTable(io, socket, msg as LeaveTableMessage);
      break;
    case "SIT_DOWN":
      await handleSitDown(io, socket, msg as SitDownMessage, userId);
      break;
    case "STAND_UP":
      await handleStandUp(io, socket, msg as StandUpMessage, userId);
      break;
    case "PLAYER_ACTION":
      await handlePlayerAction(io, socket, msg as PlayerActionMessage, userId);
      break;
    default:
      sendError(socket, "UNKNOWN_MESSAGE_TYPE", `Unknown message type: ${msg.type}`);
  }
}

async function handleJoinTable(
  io: Server,
  socket: Socket,
  msg: JoinTableMessage,
  userId: string
): Promise<void> {
  try {
    const table = await getTableById(msg.tableId);

    if (!table) {
      sendError(socket, "TABLE_NOT_FOUND", "Table does not exist.");
      return;
    }

    // Check if user is allowed (host or has a seat)
    const isHost = table.hostUserId === userId;
    const hasSeat = table.seats.some((s) => s.userId === userId);

    if (!isHost && !hasSeat) {
      sendError(socket, "NOT_IN_TABLE", "You are not a member of this table.");
      return;
    }

    // Join the table room
    socket.join(`table:${msg.tableId}`);

    // Send confirmation
    socket.emit("message", {
      type: "TABLE_JOINED",
      tableId: msg.tableId,
    });

    // Send current table state
    const tableView = await getPublicTableView(msg.tableId, userId);
    if (tableView) {
      socket.emit("message", {
        type: "TABLE_STATE",
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
  msg: LeaveTableMessage
): Promise<void> {
  socket.leave(`table:${msg.tableId}`);
}

async function handleSitDown(
  io: Server,
  socket: Socket,
  msg: SitDownMessage,
  userId: string
): Promise<void> {
  try {
    const result = await sitDown(msg.tableId, userId, msg.seatIndex, msg.buyInAmount);

    // Broadcast updated table state to all in the room
    const tableView = await getPublicTableView(msg.tableId, userId);
    io.to(`table:${msg.tableId}`).emit("message", {
      type: "TABLE_STATE",
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
  msg: StandUpMessage,
  userId: string
): Promise<void> {
  try {
    await standUp(msg.tableId, userId);

    // Broadcast updated table state
    const tableView = await getPublicTableView(msg.tableId, userId);
    io.to(`table:${msg.tableId}`).emit("message", {
      type: "TABLE_STATE",
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
  msg: PlayerActionMessage,
  userId: string
): Promise<void> {
  try {
    const result = await applyPlayerAction(msg.tableId, userId, msg.handId, {
      action: msg.action,
      amount: msg.amount,
    });

    // Broadcast action taken
    io.to(`table:${msg.tableId}`).emit("message", {
      type: "ACTION_TAKEN",
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
        io.to(`user:${event.userId}`).emit("message", {
          type: "HOLE_CARDS",
          tableId: msg.tableId,
          handId: msg.handId,
          cards: event.cards,
        });
      } else if (event.type === "HAND_RESULT") {
        io.to(`table:${msg.tableId}`).emit("message", {
          type: "HAND_RESULT",
          tableId: msg.tableId,
          handId: msg.handId,
          results: event.results,
        });
      }
    }

    // Send updated table state to all
    const tableView = await getPublicTableView(msg.tableId, userId);
    io.to(`table:${msg.tableId}`).emit("message", {
      type: "TABLE_STATE",
      tableId: msg.tableId,
      state: tableView,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    sendError(socket, errorMessage, errorMessage);
  }
}

function sendError(socket: Socket, code: string, message: string): void {
  socket.emit("message", {
    type: "ERROR",
    code,
    message,
  } as ErrorMessage);
}

