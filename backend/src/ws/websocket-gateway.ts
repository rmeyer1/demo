import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../config/auth";
import { tableHandlers } from "./table.handler";
import { handleChatMessage } from "./chat.handler";
import { logger } from "../config/logger";
import { ChatSendMessage, ErrorMessage, PongMessage } from "./types";
import {
  chatSendSchema,
  joinTableSchema,
  leaveTableSchema,
  playerActionSchema,
  sitDownSchema,
  standUpSchema,
} from "./schemas";
import { ZodSchema } from "zod";

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
