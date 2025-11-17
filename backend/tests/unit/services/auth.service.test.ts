import { describe, it, expect, beforeEach, vi } from "vitest";
import { getUserProfile, getOrCreateProfile } from "../../../src/services/auth.service";

const mockPrisma = vi.hoisted(() => ({
  profile: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("../../../src/db/prisma", () => ({ prisma: mockPrisma }));

const resetMocks = () => {
  for (const fn of Object.values(mockPrisma.profile)) {
    fn.mockReset();
  }
};

describe("auth.service", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns null when profile is missing", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const result = await getUserProfile("user-1");

    expect(result).toBeNull();
    expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("maps profile fields when found", async () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: "user-1",
      displayName: "Alice",
      createdAt,
    });

    const result = await getUserProfile("user-1");

    expect(result).toEqual({
      id: "user-1",
      displayName: "Alice",
      createdAt,
    });
  });

  it("upserts and returns profile", async () => {
    const createdAt = new Date("2024-01-02T00:00:00.000Z");
    mockPrisma.profile.upsert.mockResolvedValue({
      id: "user-2",
      displayName: "Bob",
      createdAt,
    });

    const result = await getOrCreateProfile("user-2", "Bob");

    expect(mockPrisma.profile.upsert).toHaveBeenCalledWith({
      where: { id: "user-2" },
      update: { displayName: "Bob", updatedAt: expect.any(Date) },
      create: { id: "user-2", displayName: "Bob" },
    });
    expect(result).toEqual({
      id: "user-2",
      displayName: "Bob",
      createdAt,
    });
  });
});
