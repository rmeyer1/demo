#!/usr/bin/env node
/**
 * Generate a test JWT compatible with this backend (HS256 + SUPABASE_JWT_SECRET)
 * and print handy export commands for REST + WS integration tests.
 *
 * Usage:
 *   SUPABASE_JWT_SECRET=... node scripts/gen-test-token.js [userId] [email]
 */
const dotenv = require("dotenv");
dotenv.config();

const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error("SUPABASE_JWT_SECRET is required to generate a token.");
  process.exit(1);
}

const userId = process.argv[2] || randomUUID();
const email = process.argv[3] || `${userId}@example.com`;

const payload = {
  sub: userId,
  email,
  role: "authenticated",
  aud: "authenticated",
};

const token = jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "1h" });

const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
const wsUrl = process.env.WS_URL || "ws://localhost:4000";

console.log("Test JWT generated for:", payload);
console.log("\nExport the following in your terminal session:");
console.log(`export API_BEARER_TOKEN='${token}'`);
console.log(`export API_BASE_URL='${apiBase}'`);
console.log(`export WS_URL='${wsUrl}'`);
console.log("\nOptional: set API_TEST_TABLE_ID to an existing table id for WS/chat tests.");
console.log("\nRun tests:");
console.log("  npm run test:integration");
console.log("  npm run test:ws");
