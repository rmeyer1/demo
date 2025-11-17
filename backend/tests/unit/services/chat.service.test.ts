import { describe, it, expect, beforeEach, vi } from "vitest";
import { createChatMessage, getChatHistory } from "../../../src/services/chat.service";

const mockPrisma = vi.hoisted(() => ({
  chatMessage: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../../src/db/prisma", () => ({ prisma: mockPrisma }));

const resetMocks = () => {
  for (const fn of Object.values(mockPrisma.chatMessage)) {
    fn.mockReset();
  }
};

describe("chat.service", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("throws on empty or whitespace content", async () => {
    await expect(createChatMessage("table-1", "user-1", "   ")).rejects.toThrow("CHAT_INVALID");
  });

  it("throws when content exceeds 256 chars", async () => {
    const long = "a".repeat(257);
    await expect(createChatMessage("table-1", "user-1", long)).rejects.toThrow("CHAT_INVALID");
  });

  it("sanitizes content and stores message", async () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    mockPrisma.chatMessage.create.mockResolvedValue({
      id: "msg-1",
      tableId: "table-1",
      userId: "user-1",
      seatIndex: 2,
      content: "hello",
      createdAt,
      user: { displayName: "Alice" },
    });

    const result = await createChatMessage("table-1", "user-1", "<b>he\u200bllo</b>", 2);

    expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
      data: {
        tableId: "table-1",
        userId: "user-1",
        seatIndex: 2,
        content: "hello",
      },
      include: {
        user: { select: { displayName: true } },
      },
    });
    expect(result).toEqual({
      id: "msg-1",
      userId: "user-1",
      displayName: "Alice",
      seatIndex: 2,
      content: "hello",
      createdAt,
    });
  });

  it("returns mapped chat history newest-first", async () => {
    const createdAt = new Date("2024-01-05T00:00:00.000Z");
    mockPrisma.chatMessage.findMany.mockResolvedValue([
      {
        id: "msg-1",
        userId: "user-1",
        seatIndex: null,
        content: "hey",
        createdAt,
        user: { displayName: "Alice" },
      },
    ]);

    const before = "2024-02-01T00:00:00.000Z";
    const result = await getChatHistory("table-1", 20, before);

    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: {
        tableId: "table-1",
        createdAt: { lt: new Date(before) },
      },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    expect(result).toEqual([
      {
        id: "msg-1",
        userId: "user-1",
        displayName: "Alice",
        seatIndex: null,
        content: "hey",
        createdAt,
      },
    ]);
  });
});
