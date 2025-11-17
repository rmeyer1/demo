import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
const token = process.env.API_BEARER_TOKEN;

test.describe("Tables API", () => {
  test.skip(!apiBase, "API_BASE_URL not set; skipping integration tests.");

  test("POST /api/tables requires auth", async ({ request }) => {
    const res = await request.post(`${apiBase}/api/tables`, {
      data: { name: "Integration Table", maxPlayers: 6, smallBlind: 5, bigBlind: 10 },
      timeout: 10_000,
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/tables creates table when authorized", async ({ request }) => {
    test.skip(!token, "API_BEARER_TOKEN not set; skipping authorized test.");
    const res = await request.post(`${apiBase}/api/tables`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "Integration Table", maxPlayers: 6, smallBlind: 5, bigBlind: 10 },
      timeout: 10_000,
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.inviteCode).toHaveLength(6);
  });
});
