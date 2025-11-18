import { Server, Socket } from "socket.io";
import { ChatSendMessage, ErrorMessage } from "./types";
import { createChatMessage } from "../services/chat.service";
import { getTableById } from "../services/table.service";
import { logger } from "../config/logger";
import { checkRateLimit } from "../utils/rateLimiter";

const CHAT_RATE_LIMIT_WINDOW = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 5000);
const CHAT_RATE_LIMIT_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX || 5);

export async function handleChatMessage(
  io: Server,
  socket: Socket,
  msg: ChatSendMessage
): Promise<void> {
  const userId = (socket as any).userId;

  try {
    // Rate limiting
    if (
      !checkRateLimit(`chat:${userId}`, {
        windowMs: CHAT_RATE_LIMIT_WINDOW,
        max: CHAT_RATE_LIMIT_MAX,
      })
    ) {
      sendError(socket, "CHAT_RATE_LIMIT", "Too many messages. Please slow down.");
      return;
    }

    // Validate table membership
    const table = await getTableById(msg.tableId);
    if (!table) {
      sendError(socket, "TABLE_NOT_FOUND", "Table does not exist.");
      return;
    }

    const isHost = table.hostUserId === userId;
    const hasSeat = table.seats.some((s) => s.userId === userId);

    if (!isHost && !hasSeat) {
      sendError(socket, "NOT_IN_TABLE", "You are not a member of this table.");
      return;
    }

    // Get user's seat index if seated
    const seat = table.seats.find((s) => s.userId === userId);
    const seatIndex = seat ? seat.seatIndex : null;

    // Create message
    const message = await createChatMessage(msg.tableId, userId, msg.content, seatIndex);

    // Broadcast to table room
    io.to(`table:${msg.tableId}`).emit("CHAT_MESSAGE", {
      tableId: msg.tableId,
      message: {
        id: message.id,
        userId: message.userId,
        displayName: message.displayName,
        seatIndex: message.seatIndex,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error handling CHAT_SEND:", error);
    const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (errorMessage === "CHAT_INVALID") {
      sendError(socket, "CHAT_INVALID", "Chat content is empty or too long.");
    } else {
      sendError(socket, "INTERNAL_ERROR", "Failed to send chat message.");
    }
  }
}

function sendError(socket: Socket, code: string, message: string): void {
  socket.emit("ERROR", {
    code,
    message,
  } as ErrorMessage);
}
