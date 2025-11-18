import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  table: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  profile: {
    upsert: vi.fn(),
  },
}));

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("../../../src/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../src/db/redis", () => ({ redis: mockRedis }));

let createTable: typeof import("../../../src/services/table.service").createTable;

const baseTable = {
  id: "table-1",
  hostUserId: "user-1",
  name: "Test Table",
  inviteCode: "ABC123",
  maxPlayers: 6,
  smallBlind: 5,
  bigBlind: 10,
  status: "OPEN",
  createdAt: new Date("2025-01-01T00:00:00Z"),
  seats: Array.from({ length: 6 }, (_, i) => ({
    seatIndex: i,
    userId: null,
    user: null,
    stack: 0,
    isSittingOut: false,
  })),
};

const resetMocks = () => {
  mockPrisma.table.findUnique.mockReset();
  mockPrisma.table.create.mockReset();
  mockPrisma.profile.upsert.mockReset();
  mockRedis.get.mockReset();
  mockRedis.set.mockReset();
  mockRedis.del.mockReset();
};

describe("createTable", () => {
  beforeAll(async () => {
    ({ createTable } = await import("../../../src/services/table.service"));
  });

  beforeEach(() => {
    resetMocks();
    mockPrisma.table.findUnique.mockResolvedValue(null);
    mockPrisma.table.create.mockResolvedValue(baseTable);
    mockPrisma.profile.upsert.mockResolvedValue({
      id: baseTable.hostUserId,
      displayName: "alice",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("upserts host profile when missing so FK constraint passes", async () => {
    await createTable({
      name: "Profile Backfill Table",
      maxPlayers: 6,
      smallBlind: 5,
      bigBlind: 10,
      hostUserId: "user-1",
      hostEmail: "alice@example.com",
    });

    expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        create: expect.objectContaining({ displayName: "alice" }),
        update: expect.objectContaining({ displayName: "alice" }),
      })
    );
    expect(mockPrisma.table.create).toHaveBeenCalled();
    expect(mockPrisma.profile.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.table.create.mock.invocationCallOrder[0]
    );
  });

  it("derives a stable display name when email is unavailable", async () => {
    const fallbackHostId = "host-12345";
    const expectedDisplayName = `player-${fallbackHostId.slice(0, 8)}`;

    await createTable({
      name: "Fallback Table",
      maxPlayers: 6,
      smallBlind: 5,
      bigBlind: 10,
      hostUserId: fallbackHostId,
    });

    expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: fallbackHostId },
        create: expect.objectContaining({ displayName: expectedDisplayName }),
      })
    );
  });
});
