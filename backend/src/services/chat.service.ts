import { prisma } from "../db/prisma";

export interface ChatMessageWithUser {
  id: string;
  userId: string;
  displayName: string;
  seatIndex: number | null;
  content: string;
  createdAt: Date;
}

export async function getChatHistory(
  tableId: string,
  limit: number,
  before?: string
): Promise<ChatMessageWithUser[]> {
  const messages = await prisma.chatMessage.findMany({
    where: {
      tableId,
      ...(before
        ? {
            createdAt: {
              lt: new Date(before),
            },
          }
        : {}),
    },
    include: {
      user: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return messages.map((msg) => ({
    id: msg.id,
    userId: msg.userId,
    displayName: msg.user.displayName,
    seatIndex: msg.seatIndex,
    content: msg.content,
    createdAt: msg.createdAt,
  }));
}

export async function createChatMessage(
  tableId: string,
  userId: string,
  content: string,
  seatIndex: number | null = null
) {
  // Sanitize content
  const sanitizedContent = sanitizeChatContent(content);

  if (sanitizedContent.length === 0 || sanitizedContent.length > 256) {
    throw new Error("CHAT_INVALID");
  }

  const message = await prisma.chatMessage.create({
    data: {
      tableId,
      userId,
      seatIndex,
      content: sanitizedContent,
    },
    include: {
      user: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return {
    id: message.id,
    userId: message.userId,
    displayName: message.user.displayName,
    seatIndex: message.seatIndex,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function sanitizeChatContent(content: string): string {
  // Remove HTML tags
  let sanitized = content.replace(/<[^>]*>/g, "");
  // Remove zero-width characters
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, "");
  // Trim whitespace
  sanitized = sanitized.trim();
  return sanitized;
}

