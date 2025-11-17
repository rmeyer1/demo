import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { getDashboardSummary, getDashboardProgression } from "../services/metrics.service";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/summary",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;
      const query = request.query as { range?: string };
      const range = (query.range as "lifetime" | "7d" | "30d") || "lifetime";

      try {
        const summary = await getDashboardSummary(userId, range);

        return reply.send({
          range,
          totalHands: summary.totalHands,
          netChips: summary.netChips,
          vpip: summary.vpip,
          pfr: summary.pfr,
          showdownWinPct: summary.showdownWinPct,
          bbPer100: summary.bbPer100,
        });
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch dashboard summary.",
          },
        });
      }
    }
  );

  app.get(
    "/progression",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;
      const query = request.query as { range?: string; groupBy?: string };
      const range = (query.range as "lifetime" | "7d" | "30d") || "lifetime";
      const groupBy = (query.groupBy as "day" | "hand") || "day";

      try {
        const progression = await getDashboardProgression(userId, range, groupBy);

        return reply.send({
          range,
          points: progression.points,
        });
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch dashboard progression.",
          },
        });
      }
    }
  );
}

