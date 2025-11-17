import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
const token = process.env.API_BEARER_TOKEN;

test.describe("Auth API", () => {
  test.skip(!apiBase, "API_BASE_URL not set; skipping integration tests.");

  test.only("GET /api/auth/me requires bearer token", async ({ request }) => {
    const res = await request.get(`${apiBase}/api/auth/me`, { timeout: 10_000 });
    expect(res.status()).toBe(401);
  });

  test.only("GET /api/auth/me returns profile with valid token", async ({ request }) => {
    test.skip(!token, "API_BEARER_TOKEN not set; skipping authenticated test.");
    const res = await request.get(`${apiBase}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10_000,
    });
    expect([200, 404]).toContain(res.status()); // 404 if profile missing
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.displayName).toBeTruthy();
    }
  });
});
