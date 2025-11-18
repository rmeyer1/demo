import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../config/auth";
import { tableHandlers } from "./table.handler";
import { handleChatMessage } from "./chat.handler";
import { logger } from "../config/logger";
import { ChatSendMessage, ErrorMessage, PongMessage } from "./types";
import {
  chatSendSchema,
  gameStartSchema,
  joinTableSchema,
  leaveTableSchema,
  playerActionSchema,
  sitDownSchema,
  standUpSchema,
} from "./schemas";
import { ZodSchema } from "zod";
import { startGame, getPublicTableView } from "../services/game.service";
import { getTableById } from "../services/table.service";

export function setupWebSocketGateway(io: Server): void {
  // Authentication middleware
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string);

    if (!token || typeof token !== "string") {
      return next(new Error("UNAUTHORIZED"));
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.sub;
      (socket as any).userEmail = payload.email;
      next();
    } catch (error) {
      logger.error("WebSocket auth error:", error);
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info(`WebSocket connected: ${userId}`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Send connection confirmation
    socket.emit("CONNECTED", {
      userId,
    });

    // PING / PONG
    socket.on("PING", () => {
      socket.emit("PONG", {
        timestamp: new Date().toISOString(),
      } as PongMessage);
    });

    // Table events
    socket.on("JOIN_TABLE", validateAndHandle(socket, joinTableSchema, (data) =>
      tableHandlers.handleJoinTable(io, socket, data, userId)
    ));
    socket.on("LEAVE_TABLE", validateAndHandle(socket, leaveTableSchema, (data) =>
      tableHandlers.handleLeaveTable(io, socket, data)
    ));
    socket.on("SIT_DOWN", validateAndHandle(socket, sitDownSchema, (data) =>
      tableHandlers.handleSitDown(io, socket, data, userId)
    ));
    socket.on("STAND_UP", validateAndHandle(socket, standUpSchema, (data) =>
      tableHandlers.handleStandUp(io, socket, data, userId)
    ));
    socket.on("PLAYER_ACTION", validateAndHandle(socket, playerActionSchema, (data) =>
      tableHandlers.handlePlayerAction(io, socket, data, userId)
    ));
    socket.on("GAME_START", validateAndHandle(socket, gameStartSchema, async (data) => {
      const table = await getTableById(data.tableId);
      if (!table || table.hostUserId !== userId) {
        return sendError(socket, "NOT_TABLE_HOST", "Only host can start the game.");
      }
      try {
        const result = await startGame(data.tableId, userId);
        const view = await getPublicTableView(data.tableId, userId);
        io.to(`table:${data.tableId}`).emit("TABLE_STATE", {
          tableId: data.tableId,
          state: view,
        });
        for (const event of result.events) {
          if (event.type === "HOLE_CARDS") {
            io.to(`user:${event.userId}`).emit("HOLE_CARDS", event);
          }
        }
      } catch (err: any) {
        const code = err?.message || "GAME_START_FAILED";
        sendError(socket, code, "Failed to start game.");
      }
    }));

    // Chat
    socket.on("CHAT_SEND", validateAndHandle(socket, chatSendSchema, (data) =>
      handleChatMessage(io, socket, data as ChatSendMessage)
    ));

    socket.on("disconnect", (reason) => {
      logger.info(`WebSocket disconnected: ${userId}, reason: ${reason}`);
    });
  });
}

function validateAndHandle<T>(
  socket: Socket,
  schema: ZodSchema<T>,
  handler: (data: T) => Promise<void> | void
) {
  return async (msg: unknown) => {
    const parsed = schema.safeParse(msg);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const code = firstIssue?.message || "INVALID_PAYLOAD";
      return sendError(socket, "PAYLOAD_INVALID", code);
    }

    try {
      await handler(parsed.data);
    } catch (error) {
      logger.error("Error handling WS event:", error);
      sendError(socket, "INTERNAL_ERROR", "An error occurred.");
    }
  };
}

function sendError(socket: Socket, code: string, message: string): void {
  socket.emit("ERROR", {
    code,
    message,
  } as ErrorMessage);
}
