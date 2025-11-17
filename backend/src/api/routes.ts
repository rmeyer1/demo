import { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth.controller";
import { registerTableRoutes } from "./tables.controller";
import { registerDashboardRoutes } from "./dashboard.controller";
import { registerChatRoutes } from "./chat.controller";

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get("/health", async (request, reply) => {
    return reply.send({
      status: "ok",
      version: "1.0.0",
      uptime: process.uptime(),
    });
  });

  // Register route groups
  app.register(registerAuthRoutes, { prefix: "/api/auth" });
  app.register(registerTableRoutes, { prefix: "/api/tables" });
  app.register(registerDashboardRoutes, { prefix: "/api/dashboard" });
  app.register(registerChatRoutes, { prefix: "/api" });
}

