import { prisma } from "../db/prisma";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { verifyAccessToken } from "../config/auth";
import { checkRateLimit } from "../utils/rateLimiter";

export interface UserProfile {
  id: string;
  email?: string;
  displayName: string;
  createdAt: Date;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  if (!profile) {
    return null;
  }

  // In a real implementation, you might fetch email from Supabase Auth
  // For now, we'll return what we have in the profile
  return {
    id: profile.id,
    displayName: profile.displayName,
    createdAt: profile.createdAt,
  };
}

export async function getOrCreateProfile(
  userId: string,
  displayName: string
): Promise<UserProfile> {
  const profile = await prisma.profile.upsert({
    where: { id: userId },
    update: {
      displayName,
      updatedAt: new Date(),
    },
    create: {
      id: userId,
      displayName,
    },
  });

  return {
    id: profile.id,
    displayName: profile.displayName,
    createdAt: profile.createdAt,
  };
}

export async function requestPasswordReset(email: string) {
  const rlKey = `pwdreset:req:${email.toLowerCase()}`;
  if (
    !checkRateLimit(rlKey, {
      windowMs: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MS || 5 * 60 * 1000),
      max: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 5),
    })
  ) {
    throw new Error("RESET_RATE_LIMIT");
  }

  const redirectTo = env.PASSWORD_RESET_REDIRECT_URL || undefined;
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    // Intentionally generic to avoid user enumeration
    throw new Error("RESET_REQUEST_FAILED");
  }
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  // Validate token with the Supabase JWT secret to extract the user id
  const payload = verifyAccessToken(token);
  if (!payload.sub) {
    throw new Error("INVALID_TOKEN");
  }

  const rlKey = `pwdreset:confirm:${payload.sub}`;
  if (
    !checkRateLimit(rlKey, {
      windowMs: Number(process.env.PASSWORD_RESET_CONFIRM_RATE_LIMIT_MS || 5 * 60 * 1000),
      max: Number(process.env.PASSWORD_RESET_CONFIRM_RATE_LIMIT_MAX || 5),
    })
  ) {
    throw new Error("RESET_RATE_LIMIT");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.sub, {
    password: newPassword,
  });

  if (error) {
    throw new Error("RESET_CONFIRM_FAILED");
  }

  // Optionally ensure a profile exists
  await prisma.profile.upsert({
    where: { id: payload.sub },
    update: { updatedAt: new Date() },
    create: { id: payload.sub, displayName: payload.email || `player-${payload.sub.slice(0, 8)}` },
  });
}
