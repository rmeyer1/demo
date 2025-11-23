import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";

let handCreateCalled = false;

const mockTx = vi.hoisted(() => ({
  hand: {
    findUnique: vi.fn(() => null),
    create: vi.fn(() => {
      handCreateCalled = true;
      return { id: "hand-xyz" };
    }),
  },
  playerHand: { createMany: vi.fn() },
  handAction: { createMany: vi.fn() },
  seat: { updateMany: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (cb) => {
    return cb(mockTx);
  }),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../../src/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../src/db/redis", () => ({ redis: {} }));
vi.mock("../../../src/config/logger", () => ({ logger: mockLogger }));

let persistHandToDb: any;

const resetMocks = () => {
  mockPrisma.$transaction.mockClear();
  Object.values(mockTx).forEach((section: any) =>
    Object.values(section).forEach((fn: any) => fn.mockClear?.())
  );
  Object.values(mockLogger).forEach((fn: any) => fn.mockClear?.());
  handCreateCalled = false;
};

describe("persistHandToDb", () => {
  beforeAll(async () => {
    ({ persistHandToDb } = await import("../../../src/services/game.service"));
  });

  beforeEach(() => {
    resetMocks();
  });

  it("persists hand, playerHands, actions, and seat stacks", async () => {
    const handState = {
      handId: "hand-1",
      handNumber: 5,
      dealerSeatIndex: 0,
      smallBlindSeatIndex: 1,
      bigBlindSeatIndex: 2,
      communityCards: [
        { rank: "A", suit: "♠" },
        { rank: "K", suit: "♣" },
        { rank: "5", suit: "♦" },
      ],
      street: "RIVER",
      playerStates: [
        { seatIndex: 0, userId: "u1", holeCards: [{ rank: "A", suit: "♥" }, { rank: "A", suit: "♦" }], totalBet: 40, status: "ACTIVE" },
        { seatIndex: 1, userId: "u2", holeCards: [{ rank: "K", suit: "♥" }, { rank: "Q", suit: "♣" }], totalBet: 60, status: "ACTIVE" },
      ],
      betting: {
        street: "RIVER",
        lastAggressorSeatIndex: 1,
      },
    };

    const events = [
      {
        type: "PLAYER_ACTION_APPLIED",
        seatIndex: 1,
        action: "BET",
        amount: 60,
        betting: { street: "RIVER" },
      },
      {
        type: "HAND_RESULT",
        winners: [{ seatIndex: 0, wonAmount: 100, handRank: "SET" }],
        finalStacks: [
          { seatIndex: 0, stack: 200 },
          { seatIndex: 1, stack: 50 },
        ],
      },
      { type: "HAND_COMPLETE" },
    ];

    const seats = [
      { seatIndex: 0, userId: "u1", stack: 200 },
      { seatIndex: 1, userId: "u2", stack: 50 },
    ];

    await persistHandToDb("table-1", handState, events, seats);

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(handCreateCalled).toBe(true);
    expect(mockTx.hand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "table-1",
          handNumber: BigInt(5),
          dealerSeatIndex: 0,
          communityCards: ["A♠", "K♣", "5♦"],
          status: "COMPLETE",
        }),
      })
    );

    expect(mockTx.playerHand.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: "u1",
            netChips: 100 - 40,
            vpipFlag: false,
            pfrFlag: false,
            sawShowdown: true,
            wonShowdown: true,
            finalHandRank: "SET",
            seatIndex: 0,
            tableId: "table-1",
            holeCards: expect.arrayContaining(["A♥", "A♦"]),
          }),
          expect.objectContaining({
            userId: "u2",
            seatIndex: 1,
            tableId: "table-1",
            vpipFlag: false,
            pfrFlag: false,
            wonShowdown: false,
            holeCards: expect.arrayContaining(["K♥", "Q♣"]),
          }),
        ]),
      })
    );

    expect(mockTx.handAction.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            seatIndex: 1,
            actionType: "BET",
            street: "RIVER",
            amount: 60,
            userId: "u2",
          }),
        ],
      })
    );

    expect(mockTx.seat.updateMany).toHaveBeenCalledTimes(2);
  });

  it("warns and no-ops when handState is null", async () => {
    await persistHandToDb("table-1", null, [], []);
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
