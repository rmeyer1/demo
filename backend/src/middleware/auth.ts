import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, extractTokenFromHeader } from "../config/auth";

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  userEmail?: string;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractTokenFromHeader(request.headers.authorization);

  if (!token) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid token.",
      },
    });
  }

  try {
    const payload = verifyAccessToken(token);
    (request as AuthenticatedRequest).userId = payload.sub;
    (request as AuthenticatedRequest).userEmail = payload.email;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "INVALID_TOKEN";
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: errorMessage === "TOKEN_EXPIRED" ? "Token expired." : "Invalid token.",
      },
    });
  }
}

