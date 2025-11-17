import { defineConfig } from "@playwright/test";

const baseURL = process.env.API_BASE_URL || ""; // e.g. http://localhost:4000

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  use: {
    baseURL: baseURL || undefined,
  },
});
