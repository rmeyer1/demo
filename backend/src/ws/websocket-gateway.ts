import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../config/auth";
import { handleTableMessage } from "./table.handler";
import { handleChatMessage } from "./chat.handler";
import { logger } from "../config/logger";
import { ChatSendMessage, PongMessage } from "./types";

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
    socket.emit("message", {
      type: "CONNECTED",
      userId,
    });

    // Handle incoming messages
    socket.on("message", async (msg: any) => {
      try {
        if (!msg || typeof msg !== "object" || !msg.type) {
          socket.emit("message", {
            type: "ERROR",
            code: "INVALID_MESSAGE",
            message: "Invalid message format.",
          });
          return;
        }

        // Route message by type
        if (msg.type.startsWith("CHAT_")) {
          await handleChatMessage(io, socket, msg as ChatSendMessage);
        } else if (msg.type === "PING") {
          socket.emit("message", {
            type: "PONG",
            timestamp: new Date().toISOString(),
          } as PongMessage);
        } else {
          await handleTableMessage(io, socket, msg);
        }
      } catch (error) {
        logger.error("Error handling WebSocket message:", error);
        socket.emit("message", {
          type: "ERROR",
          code: "INTERNAL_ERROR",
          message: "An error occurred processing your message.",
        });
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info(`WebSocket disconnected: ${userId}, reason: ${reason}`);
    });
  });
}
