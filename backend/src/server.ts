import "dotenv/config";
import fastify from "fastify";
import cors from "@fastify/cors";
import { Server as SocketIOServer } from "socket.io";
import { registerRoutes } from "./api/routes";
import { setupWebSocketGateway } from "./ws/websocket-gateway";
import { env } from "./config/env";
import { logger } from "./config/logger";

const PORT = env.PORT;

async function start() {
  const app = fastify({
    logger: env.NODE_ENV === "development",
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register REST routes
  await registerRoutes(app);

  // Prepare Fastify
  await app.ready();

  // Attach Socket.IO to Fastify's underlying server
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Setup WebSocket gateway
  setupWebSocketGateway(io);

  // Start server
  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Backend listening on http://localhost:${PORT}`);
  logger.info(`WebSocket available on ws://localhost:${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
}

start().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
