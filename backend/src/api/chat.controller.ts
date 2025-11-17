import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { getChatHistory } from "../services/chat.service";

export async function registerChatRoutes(app: FastifyInstance) {
  app.get(
    "/tables/:id/chat",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as { limit?: string; before?: string };

      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 200) : 50;
      const before = query.before || undefined;

      try {
        const messages = await getChatHistory(params.id, limit, before);

        return reply.send(
          messages.map((msg) => ({
            id: msg.id,
            userId: msg.userId,
            displayName: msg.displayName,
            seatIndex: msg.seatIndex,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          }))
        );
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch chat history.",
          },
        });
      }
    }
  );
}

