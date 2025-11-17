import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
const token = process.env.API_BEARER_TOKEN;

test.describe("Dashboard API", () => {
  test.skip(!apiBase, "API_BASE_URL not set; skipping integration tests.");

  test("GET /api/dashboard/summary requires auth", async ({ request }) => {
    const res = await request.get(`${apiBase}/api/dashboard/summary`, { timeout: 10_000 });
    expect(res.status()).toBe(401);
  });

  test("GET /api/dashboard/summary returns metrics", async ({ request }) => {
    test.skip(!token, "API_BEARER_TOKEN not set; skipping authorized test.");
    const res = await request.get(`${apiBase}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10_000,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("netChips");
    expect(body).toHaveProperty("vpip");
  });
});
