import jwt from "jsonwebtoken";
import { env } from "./env";

export interface AuthTokenPayload {
  sub: string; // user id
  email?: string;
  aud?: string;
  role?: string;
  exp?: number;
  iat?: number;
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  try {
    // Supabase uses HS256 with the JWT secret
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
      algorithms: ["HS256"],
    }) as AuthTokenPayload;

    if (!payload.sub) {
      throw new Error("Token missing user ID");
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("TOKEN_EXPIRED");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("INVALID_TOKEN");
    }
    throw new Error("INVALID_TOKEN");
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

