import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTable,
  sitDown,
  standUp,
  getTableStateFromRedis,
  setTableStateInRedis,
  deleteTableStateFromRedis,
} from "../../../src/services/table.service";

const mockPrisma = vi.hoisted(() => ({
  table: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  seat: {
    findFirst: vi.fn(),
    update: vi.fn(),
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

const resetMocks = () => {
  for (const section of Object.values(mockPrisma)) {
    for (const fn of Object.values(section as Record<string, any>)) {
      fn.mockReset();
    }
  }
  for (const fn of Object.values(mockRedis)) {
    fn.mockReset();
  }
};

describe("table.service", () => {
  beforeEach(() => {
    resetMocks();
    mockPrisma.profile.upsert.mockResolvedValue({
      id: "user-1",
      displayName: "player-user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("generates a new invite code after a collision, ensures host profile, and creates seats", async () => {
    mockPrisma.table.findUnique
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);

    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    mockPrisma.table.create.mockResolvedValue({
      id: "table-1",
      hostUserId: "user-1",
      name: "Friday Night",
      inviteCode: "BBBBBB",
      maxPlayers: 2,
      smallBlind: 5,
      bigBlind: 10,
      status: "OPEN",
      createdAt,
      seats: [
        { seatIndex: 0, userId: null, stack: 0, isSittingOut: false, user: { displayName: null } },
        { seatIndex: 1, userId: null, stack: 0, isSittingOut: false, user: { displayName: null } },
      ],
    });

    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.03)
      .mockReturnValueOnce(0.03)
      .mockReturnValueOnce(0.03)
      .mockReturnValueOnce(0.03)
      .mockReturnValueOnce(0.03)
      .mockReturnValueOnce(0.03);

    const result = await createTable({
      name: "Friday Night",
      maxPlayers: 2,
      smallBlind: 5,
      bigBlind: 10,
      hostUserId: "user-1",
      hostEmail: "host@example.com",
    });

    expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        create: expect.objectContaining({ displayName: "host" }),
      })
    );
    expect(mockPrisma.table.findUnique).toHaveBeenCalledTimes(2);
    expect(mockPrisma.table.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteCode: "BBBBBB",
          maxPlayers: 2,
          name: "Friday Night",
          hostUserId: "user-1",
        }),
      })
    );
    expect(result.inviteCode).toBe("BBBBBB");
    expect(result.seats).toHaveLength(2);
    expect(result.createdAt).toEqual(createdAt);

    randomSpy.mockRestore();
  });

  it("derives a stable profile name when no email is provided", async () => {
    mockPrisma.table.findUnique.mockResolvedValue(null);
    mockPrisma.table.create.mockResolvedValue({
      id: "table-2",
      hostUserId: "host-12345",
      name: "Fallback Table",
      inviteCode: "ABCDEF",
      maxPlayers: 6,
      smallBlind: 5,
      bigBlind: 10,
      status: "OPEN",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      seats: [],
    });

    await createTable({
      name: "Fallback Table",
      maxPlayers: 6,
      smallBlind: 5,
      bigBlind: 10,
      hostUserId: "host-12345",
    });

    expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "host-12345" },
        create: expect.objectContaining({ displayName: "player-host-123" }),
      })
    );
  });

  it("throws when sitDown targets a taken seat", async () => {
    mockPrisma.seat.findFirst.mockResolvedValue({
      id: "seat-1",
      seatIndex: 0,
      tableId: "table-1",
      userId: "someone-else",
    });

    await expect(sitDown("table-1", "user-2", 0, 100)).rejects.toThrow("SEAT_TAKEN");
    expect(mockPrisma.seat.update).not.toHaveBeenCalled();
  });

  it("throws when buy-in is invalid", async () => {
    mockPrisma.seat.findFirst.mockResolvedValue({
      id: "seat-1",
      seatIndex: 0,
      tableId: "table-1",
      userId: null,
    });

    await expect(sitDown("table-1", "user-2", 0, 0)).rejects.toThrow("INVALID_BUYIN");
    expect(mockPrisma.seat.update).not.toHaveBeenCalled();
  });

  it("sits a player and returns seat info", async () => {
    mockPrisma.seat.findFirst.mockResolvedValue({
      id: "seat-1",
      seatIndex: 0,
      tableId: "table-1",
      userId: null,
      stack: 0,
      isSittingOut: false,
    });

    mockPrisma.seat.update.mockResolvedValue({
      id: "seat-1",
      seatIndex: 0,
      tableId: "table-1",
      userId: "user-2",
      stack: 200,
      isSittingOut: false,
      user: { displayName: "Player Two" },
    });

    const result = await sitDown("table-1", "user-2", 0, 200);

    expect(mockPrisma.seat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-2", stack: 200, isSittingOut: false }),
      })
    );
    expect(result).toEqual({
      tableId: "table-1",
      seatIndex: 0,
      userId: "user-2",
      displayName: "Player Two",
      stack: 200,
      isSittingOut: false,
    });
  });

  it("throws when standUp cannot find player", async () => {
    mockPrisma.seat.findFirst.mockResolvedValue(null);

    await expect(standUp("table-1", "user-2")).rejects.toThrow("NOT_SEATED");
    expect(mockPrisma.seat.update).not.toHaveBeenCalled();
  });

  it("clears seat and returns remaining stack on standUp", async () => {
    mockPrisma.seat.findFirst.mockResolvedValue({
      id: "seat-1",
      seatIndex: 1,
      tableId: "table-1",
      userId: "user-2",
      stack: 150,
    });
    mockPrisma.seat.update.mockResolvedValue({});

    const result = await standUp("table-1", "user-2");

    expect(mockPrisma.seat.update).toHaveBeenCalledWith({
      where: { id: "seat-1" },
      data: { userId: null, stack: 0 },
    });
    expect(result).toEqual({ tableId: "table-1", seatIndex: 1, remainingStack: 150 });
  });

  it("round-trips table state through redis helpers", async () => {
    const state = { tableId: "table-1", pot: 120 };
    mockRedis.get.mockResolvedValue(JSON.stringify(state));

    const fromRedis = await getTableStateFromRedis("table-1");
    expect(fromRedis).toEqual(state);

    await setTableStateInRedis("table-1", state);
    expect(mockRedis.set).toHaveBeenCalledWith("table:state:table-1", JSON.stringify(state));

    await deleteTableStateFromRedis("table-1");
    expect(mockRedis.del).toHaveBeenCalledWith("table:state:table-1");
  });
});
