import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
const token = process.env.API_BEARER_TOKEN;
const tableId = process.env.API_TEST_TABLE_ID; // optional pre-created table for chat fetch

test.describe("Chat API", () => {
  test.skip(!apiBase, "API_BASE_URL not set; skipping integration tests.");

  test("GET /api/tables/:id/chat requires auth", async ({ request }) => {
    test.skip(!tableId, "API_TEST_TABLE_ID not provided.");
    const res = await request.get(`${apiBase}/api/tables/${tableId}/chat`, { timeout: 10_000 });
    expect(res.status()).toBe(401);
  });

  test("GET /api/tables/:id/chat returns history", async ({ request }) => {
    test.skip(!tableId || !token, "API_TEST_TABLE_ID or API_BEARER_TOKEN not set.");
    const res = await request.get(`${apiBase}/api/tables/${tableId}/chat`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10_000,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.messages || body)).toBe(true);
  });
});
