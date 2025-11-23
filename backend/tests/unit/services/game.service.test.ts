import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyPlayerAction, startHand, getPublicTableView } from "../../../src/services/game.service";

const mockTx = vi.hoisted(() => ({
  hand: {
    create: vi.fn().mockResolvedValue({ id: "hand-id" }),
  },
  playerHand: {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  handAction: {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  seat: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  table: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (cb) => cb(mockTx)),
  hand: mockTx.hand,
  playerHand: mockTx.playerHand,
  handAction: mockTx.handAction,
  seat: mockTx.seat,
}));

const mockTableService = vi.hoisted(() => ({
  getTableStateFromRedis: vi.fn(),
  setTableStateInRedis: vi.fn(),
  deleteTableStateFromRedis: vi.fn(),
}));

const mockEngine = vi.hoisted(() => ({
  applyPlayerAction: vi.fn(),
  advanceIfReady: vi.fn(),
  startHand: vi.fn(),
  getPublicTableView: vi.fn(),
  initTableState: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../../src/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../src/db/redis", () => ({ redis: {} }));
vi.mock("../../../src/services/table.service", () => mockTableService);
vi.mock("../../../src/engine", () => mockEngine);
vi.mock("../../../src/config/logger", () => ({ logger: mockLogger }));

const baseState = {
  seats: [
    { seatIndex: 0, userId: "user-1" },
    { seatIndex: 1, userId: "user-2" },
  ],
  currentHand: {
    handId: "hand-1",
    toActSeatIndex: 0,
  },
};

const resetMocks = () => {
  for (const section of [mockPrisma.table]) {
    for (const fn of Object.values(section)) {
      fn.mockClear();
    }
  }
  mockPrisma.$transaction.mockClear();
  Object.values(mockTx.hand).forEach((fn) => fn.mockClear?.());
  Object.values(mockTx.playerHand).forEach((fn) => fn.mockClear?.());
  Object.values(mockTx.handAction).forEach((fn) => fn.mockClear?.());
  Object.values(mockTx.seat).forEach((fn) => fn.mockClear?.());

  for (const fn of Object.values(mockTableService)) {
    fn.mockClear();
  }
  for (const fn of Object.values(mockEngine)) {
    fn.mockClear();
  }
  for (const fn of Object.values(mockLogger)) {
    fn.mockClear();
  }
};

describe("game.service", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("throws when no table state is available", async () => {
    mockTableService.getTableStateFromRedis.mockResolvedValue(null);
    mockPrisma.table.findUnique.mockResolvedValue(null);

    await expect(
      applyPlayerAction("table-1", "user-1", "hand-1", { action: "CHECK" })
    ).rejects.toThrow("TABLE_STATE_NOT_FOUND");
  });

  it("throws when it is not the player's turn", async () => {
    mockTableService.getTableStateFromRedis.mockResolvedValue({
      ...baseState,
      currentHand: { ...baseState.currentHand, toActSeatIndex: 1 },
    });

    await expect(
      applyPlayerAction("table-1", "user-1", "hand-1", { action: "CHECK" })
    ).rejects.toThrow("NOT_YOUR_TURN");
    expect(mockEngine.applyPlayerAction).not.toHaveBeenCalled();
  });

  it("returns stale when handId does not match current hand", async () => {
    mockTableService.getTableStateFromRedis.mockResolvedValue({
      ...baseState,
      currentHand: { ...baseState.currentHand, handId: "hand-2" },
    });

    const result = await applyPlayerAction("table-1", "user-1", "hand-1", { action: "CHECK" });

    expect(result).toEqual({ stale: true });
    expect(mockEngine.applyPlayerAction).not.toHaveBeenCalled();
    expect(mockTableService.setTableStateInRedis).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Stale action rejected",
      expect.objectContaining({
        tableId: "table-1",
        userId: "user-1",
        handId: "hand-1",
        currentHandId: "hand-2",
      })
    );
  });

  it("applies action and saves updated state", async () => {
    const updatedState = { ...baseState, currentHand: { ...baseState.currentHand, toActSeatIndex: 1 }, pot: 50 };

    mockTableService.getTableStateFromRedis.mockResolvedValue(baseState);
    mockEngine.applyPlayerAction.mockReturnValue({ state: updatedState, events: [] });
    mockEngine.advanceIfReady.mockReturnValue(null);

    const result = await applyPlayerAction("table-1", "user-1", "hand-1", { action: "CHECK" });

    expect(mockEngine.applyPlayerAction).toHaveBeenCalledWith(baseState, 0, { action: "CHECK" });
    expect(mockTableService.setTableStateInRedis).toHaveBeenCalledWith("table-1", updatedState);
    expect(result.state).toEqual(updatedState);
  });

  it("persists hand when HAND_COMPLETE event occurs", async () => {
    const handState = {
      handId: "hand-1",
      handNumber: 10,
      dealerSeatIndex: 0,
      smallBlindSeatIndex: 0,
      bigBlindSeatIndex: 1,
      communityCards: [],
      street: "RIVER",
      potTotal: 50,
      toActSeatIndex: 0,
      playerStates: [
        {
          seatIndex: 0,
          userId: "user-1",
          holeCards: [
            { rank: "A", suit: "♠" },
            { rank: "K", suit: "♣" },
          ],
          totalBet: 20,
          status: "ACTIVE",
          currentBet: 0,
          isAllIn: false,
        },
        {
          seatIndex: 1,
          userId: "user-2",
          holeCards: [
            { rank: "Q", suit: "♠" },
            { rank: "Q", suit: "♦" },
          ],
          totalBet: 30,
          status: "ACTIVE",
          currentBet: 0,
          isAllIn: false,
        },
      ],
      betting: {
        street: "RIVER",
        currentBet: 0,
        minRaise: 10,
        lastAggressorSeatIndex: 1,
        contributions: { 0: 20, 1: 30 },
      },
    };

    const midState = { ...baseState, currentHand: handState };
    const completedState = {
      ...midState,
      seats: [
        { seatIndex: 0, userId: "user-1", stack: 120 },
        { seatIndex: 1, userId: "user-2", stack: 70 },
      ],
    };

    mockTableService.getTableStateFromRedis.mockResolvedValue(midState);
    mockEngine.applyPlayerAction.mockReturnValue({
      state: midState,
      events: [
        {
          type: "PLAYER_ACTION_APPLIED",
          seatIndex: 0,
          action: "CHECK",
          amount: 0,
          betting: { street: "RIVER" },
        },
      ],
    });
    mockEngine.advanceIfReady.mockReturnValue({
      state: completedState,
      events: [
        {
          type: "HAND_RESULT",
          winners: [{ seatIndex: 0, wonAmount: 50, handRank: "PAIR" }],
          finalStacks: [
            { seatIndex: 0, stack: 120 },
            { seatIndex: 1, stack: 70 },
          ],
        },
        { type: "HAND_COMPLETE" },
      ],
    });

    const result = await applyPlayerAction("table-1", "user-1", "hand-1", { action: "CHECK" });

    expect(result.events.map((e: any) => e.type)).toContain("HAND_COMPLETE");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("startHand uses existing state and saves it", async () => {
    const startedState = { ...baseState, currentHand: { ...baseState.currentHand, toActSeatIndex: 1 }, started: true };
    mockTableService.getTableStateFromRedis.mockResolvedValue(baseState);
    mockEngine.startHand.mockReturnValue({ state: startedState, events: [] });

    const result = await startHand("table-1");

    expect(mockEngine.startHand).toHaveBeenCalledWith(baseState);
    expect(mockTableService.setTableStateInRedis).toHaveBeenCalledWith("table-1", startedState);
    expect(result.state).toEqual(startedState);
  });

  it("getPublicTableView returns null when no state", async () => {
    mockTableService.getTableStateFromRedis.mockResolvedValue(null);

    const result = await getPublicTableView("table-1", "user-1");
    expect(result).toBeNull();
    expect(mockEngine.getPublicTableView).not.toHaveBeenCalled();
  });

  it("getPublicTableView delegates to engine", async () => {
    mockTableService.getTableStateFromRedis.mockResolvedValue(baseState);
    mockEngine.getPublicTableView.mockReturnValue({ view: true });

    const result = await getPublicTableView("table-1", "user-1");

    expect(mockEngine.getPublicTableView).toHaveBeenCalledWith(baseState, "user-1");
    expect(result).toEqual({ view: true });
  });
});
