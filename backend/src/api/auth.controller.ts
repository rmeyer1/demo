import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { getUserProfile } from "../services/auth.service";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const req = request as AuthenticatedRequest;
    const userId = req.userId;

    const profile = await getUserProfile(userId);

    if (!profile) {
      return reply.status(404).send({
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "User profile not found.",
        },
      });
    }

    return reply.send({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      createdAt: profile.createdAt.toISOString(),
    });
  });
}

