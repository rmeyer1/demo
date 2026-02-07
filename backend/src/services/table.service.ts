import { prisma } from "../db/prisma";
import { redis } from "../db/redis";

export interface CreateTableInput {
  name: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  hostUserId: string;
  hostEmail?: string;
  hostDisplayName?: string;
}

export interface TableWithSeats {
  id: string;
  hostUserId: string;
  name: string;
  inviteCode: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  status: string;
  createdAt: Date;
  seats: Array<{
    seatIndex: number;
    userId: string | null;
    displayName: string | null;
    stack: number;
    isSittingOut: boolean;
  }>;
}

function generateInviteCode(): string {
  // Simple code generation - can be improved
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function resolveHostDisplayName(input: CreateTableInput): string {
  if (input.hostDisplayName?.trim()) {
    return input.hostDisplayName.trim();
  }

  if (input.hostEmail) {
    const localPart = input.hostEmail.split("@")[0];
    if (localPart) {
      return localPart;
    }
  }

  return `player-${input.hostUserId.slice(0, 8)}`;
}

function resolveGenericDisplayName(userId: string) {
  return `player-${userId.slice(0, 8)}`;
}

export async function createTable(input: CreateTableInput): Promise<TableWithSeats> {
  const table = await prisma.$transaction(async (tx) => {
    // Generate unique invite code inside the same transaction to avoid races
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (await tx.table.findUnique({ where: { inviteCode } })) {
      inviteCode = generateInviteCode();
      attempts++;
      if (attempts > 10) {
        throw new Error("Failed to generate unique invite code");
      }
    }

    // Ensure the hosting user has a profile row to satisfy FK constraint
    const hostDisplayName = resolveHostDisplayName(input);
    await tx.profile.upsert({
      where: { id: input.hostUserId },
      update: { displayName: hostDisplayName, updatedAt: new Date() },
      create: { id: input.hostUserId, displayName: hostDisplayName },
    });

    return tx.table.create({
      data: {
        hostUserId: input.hostUserId,
        name: input.name,
        inviteCode,
        maxPlayers: input.maxPlayers,
        smallBlind: input.smallBlind,
        bigBlind: input.bigBlind,
        status: "OPEN",
        seats: {
          create: Array.from({ length: input.maxPlayers }, (_, i) => ({
            seatIndex: i,
            userId: null,
            stack: 0,
            isSittingOut: false,
          })),
        },
      },
      include: {
        seats: {
          include: {
            user: {
              select: {
                displayName: true,
              },
            },
          },
          orderBy: {
            seatIndex: "asc",
          },
        },
      },
    });
  });

  return formatTableWithSeats(table);
}

export async function getTableById(tableId: string): Promise<TableWithSeats | null> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      seats: {
        include: {
          user: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: {
          seatIndex: "asc",
        },
      },
    },
  });

  if (!table) {
    return null;
  }

  return formatTableWithSeats(table);
}

export async function getTableByInviteCode(inviteCode: string): Promise<TableWithSeats | null> {
  const table = await prisma.table.findFirst({
    where: { inviteCode },
    include: {
      seats: {
        include: {
          user: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: {
          seatIndex: "asc",
        },
      },
    },
  });

  if (!table) {
    return null;
  }

  return formatTableWithSeats(table);
}

export async function getPublicOpenTables(limit = 50, offset = 0) {
  const tables = await prisma.table.findMany({
    where: {
      status: "OPEN",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    skip: offset,
    include: {
      host: {
        select: {
          displayName: true,
        },
      },
      seats: {
        where: {
          userId: {
            not: null,
          },
        },
        select: {
          userId: true,
        },
      },
    },
  });

  return tables.map((table) => ({
    id: table.id,
    name: table.name,
    host: table.host.displayName,
    maxPlayers: table.maxPlayers,
    currentPlayerCount: table.seats.length,
    inviteCode: table.inviteCode,
    blinds: {
      small: table.smallBlind,
      big: table.bigBlind,
    },
    createdAt: table.createdAt,
  }));
}

export async function getUserTables(userId: string, limit = 20, offset = 0) {
  const tables = await prisma.table.findMany({
    where: {
      OR: [
        { hostUserId: userId },
        {
          seats: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
    skip: offset,
    select: {
      id: true,
      name: true,
      status: true,
      maxPlayers: true,
      smallBlind: true,
      bigBlind: true,
      hostUserId: true,
      createdAt: true,
    },
  });

  return tables;
}

export async function sitDown(
  tableId: string,
  userId: string,
  seatIndex: number,
  buyInAmount: number
) {
  // Guardrails: one seat per user, one table at a time (MVP)
  const existingSeat = await prisma.seat.findFirst({
    where: {
      userId,
    },
    select: {
      id: true,
      tableId: true,
      seatIndex: true,
    },
  });

  if (existingSeat) {
    if (existingSeat.tableId === tableId) {
      throw new Error("ALREADY_SEATED");
    }
    throw new Error("IN_ANOTHER_TABLE");
  }

  // Check if seat is available
  const seat = await prisma.seat.findFirst({
    where: {
      tableId,
      seatIndex,
    },
  });

  if (!seat) {
    throw new Error("INVALID_SEAT");
  }

  if (seat.userId !== null) {
    throw new Error("SEAT_TAKEN");
  }

  if (buyInAmount <= 0) {
    throw new Error("INVALID_BUYIN");
  }

  // Ensure profile row exists for FK constraint
  await prisma.profile.upsert({
    where: { id: userId },
    update: { updatedAt: new Date() },
    create: { id: userId, displayName: resolveGenericDisplayName(userId) },
  });

  // Update seat
  const updatedSeat = await prisma.seat.update({
    where: { id: seat.id },
    data: {
      userId,
      stack: buyInAmount,
      isSittingOut: false,
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
    tableId,
    seatIndex,
    userId,
    displayName: updatedSeat.user?.displayName || "Unknown",
    stack: updatedSeat.stack,
    isSittingOut: updatedSeat.isSittingOut,
  };
}

export async function standUp(tableId: string, userId: string) {
  const seat = await prisma.seat.findFirst({
    where: {
      tableId,
      userId,
    },
  });

  if (!seat) {
    throw new Error("NOT_SEATED");
  }

  const remainingStack = seat.stack;

  await prisma.seat.update({
    where: { id: seat.id },
    data: {
      userId: null,
      stack: 0,
    },
  });

  return {
    tableId,
    seatIndex: seat.seatIndex,
    remainingStack,
  };
}

// Reactivate a seated player when they reconnect (clear sitting out flag)
export async function activateSeat(tableId: string, userId: string): Promise<boolean> {
  const result = await prisma.seat.updateMany({
    where: { tableId, userId, isSittingOut: true },
    data: { isSittingOut: false },
  });

  return result.count > 0;
}

function formatTableWithSeats(table: any): TableWithSeats {
  return {
    id: table.id,
    hostUserId: table.hostUserId,
    name: table.name,
    inviteCode: table.inviteCode,
    maxPlayers: table.maxPlayers,
    smallBlind: table.smallBlind,
    bigBlind: table.bigBlind,
    status: table.status,
    createdAt: table.createdAt,
    seats: table.seats.map((seat: any) => ({
      seatIndex: seat.seatIndex,
      userId: seat.userId,
      displayName: seat.user?.displayName || null,
      stack: seat.stack,
      isSittingOut: seat.isSittingOut,
    })),
  };
}

// Redis helpers for table state
export async function getTableStateFromRedis(tableId: string): Promise<any | null> {
  const state = await redis.get(`table:state:${tableId}`);
  return state ? JSON.parse(state) : null;
}

export async function setTableStateInRedis(tableId: string, state: any): Promise<void> {
  await redis.set(`table:state:${tableId}`, JSON.stringify(state));
}

export async function deleteTableStateFromRedis(tableId: string): Promise<void> {
  await redis.del(`table:state:${tableId}`);
}
