import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

const apiBase = process.env.API_BASE_URL || "http://localhost:4000";

test.describe("Health API", () => {
  test.skip(!apiBase, "API_BASE_URL not set; skipping integration tests.");

  test("GET /health returns ok status", async ({ request }) => {
    const response = await request.get(`${apiBase}/health`, { timeout: 10_000 });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBeTruthy();
  });
});
