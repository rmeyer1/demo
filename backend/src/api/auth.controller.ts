import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import {
  getUserProfile,
  requestPasswordReset,
  confirmPasswordReset,
} from "../services/auth.service";

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

  app.post("/password-reset/request", async (request: FastifyRequest, reply: FastifyReply) => {
    const bodySchema = z.object({
      email: z.string().email(),
    });

    let email: string;
    try {
      ({ email } = bodySchema.parse(request.body));
    } catch (err) {
      return reply.status(400).send({
        error: { code: "INVALID_EMAIL", message: "A valid email is required." },
      });
    }

    try {
      await requestPasswordReset(email);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "RESET_RATE_LIMIT") {
        return reply.status(429).send({
          error: { code: "RESET_RATE_LIMIT", message: "Too many requests. Please try again later." },
        });
      }
      // Always return generic success to avoid user enumeration
    }

    return reply.send({ status: "ok" });
  });

  app.post("/password-reset/confirm", async (request: FastifyRequest, reply: FastifyReply) => {
    const bodySchema = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(6),
    });

    let parsed: { token: string; newPassword: string };
    try {
      parsed = bodySchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({
        error: { code: "INVALID_PAYLOAD", message: "Token and a 6+ character password are required." },
      });
    }

    try {
      await confirmPasswordReset(parsed.token, parsed.newPassword);
      return reply.send({ status: "ok" });
    } catch (err) {
      if (err instanceof Error && err.message === "RESET_RATE_LIMIT") {
        return reply.status(429).send({
          error: { code: "RESET_RATE_LIMIT", message: "Too many attempts. Please try again later." },
        });
      }
      return reply.status(400).send({
        error: { code: "RESET_CONFIRM_FAILED", message: "Could not reset password. The link may be invalid or expired." },
      });
    }
  });
}
