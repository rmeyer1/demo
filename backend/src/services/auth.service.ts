import { prisma } from "../db/prisma";

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

