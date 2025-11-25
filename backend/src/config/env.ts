import dotenv from "dotenv";

dotenv.config();

export const env = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || "",
  PASSWORD_RESET_REDIRECT_URL: process.env.PASSWORD_RESET_REDIRECT_URL || "",

  // Application URLs
  APP_URL: process.env.APP_URL || "http://localhost:3000", // Frontend application URL
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:4000", // Backend API URL

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  // Server
  PORT: Number(process.env.PORT || 4000),
  NODE_ENV: process.env.NODE_ENV || "development",
} as const;

// Validate required environment variables
const requiredEnvVars = [
  "SUPABASE_URL",
  "DATABASE_URL",
  "SUPABASE_JWT_SECRET",
  "APP_URL", // Added APP_URL
  "BACKEND_URL", // Added BACKEND_URL
] as const;

for (const envVar of requiredEnvVars) {
  if (!env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
