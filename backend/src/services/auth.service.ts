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

export interface RegisterResult {
  user: UserProfile & { email: string };
  token: string;
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string
): Promise<RegisterResult> {
  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for MVP
  });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      throw new Error("EMAIL_EXISTS");
    }
    if (authError.message.includes("password")) {
      throw new Error("WEAK_PASSWORD");
    }
    throw new Error("REGISTRATION_FAILED");
  }

  if (!authData.user) {
    throw new Error("REGISTRATION_FAILED");
  }

  const userId = authData.user.id;

  // Create profile in database
  const profile = await prisma.profile.create({
    data: {
      id: userId,
      displayName: displayName.trim() || `player-${userId.slice(0, 8)}`,
    },
  });

  // Generate JWT token for the user
  const { data: signInData, error: signInError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  // Fallback: create a session directly using signInWithPassword
  const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError || !sessionData.session) {
    // Even if session creation fails, user is created - they can login separately
    throw new Error("SESSION_CREATION_FAILED");
  }

  return {
    user: {
      id: profile.id,
      email: authData.user.email!,
      displayName: profile.displayName,
      createdAt: profile.createdAt,
    },
    token: sessionData.session.access_token,
  };
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
