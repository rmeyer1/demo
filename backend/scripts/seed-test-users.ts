import "dotenv/config";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { User, createClient } from "@supabase/supabase-js";

// Minimal, self-contained script to seed Supabase auth users + Prisma profiles for automated tests.

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed test users.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prisma = new PrismaClient();

type SeedUser = {
  email: string;
  password: string;
  displayName: string;
};

const TEST_USERS: SeedUser[] = [
  {
    email: "alice.test@example.com",
    password: "Password123!",
    displayName: "Alice Test",
  },
  {
    email: "bob.test@example.com",
    password: "Password123!",
    displayName: "Bob Test",
  },
];

const TEST_TABLE = {
  inviteCode: "TEST123",
  name: "Automated Test Table",
  maxPlayers: 6,
  smallBlind: 5,
  bigBlind: 10,
  status: "OPEN" as const,
};

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data) {
    throw new Error(`Failed to list Supabase users: ${error?.message}`);
  }
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureAuthUser(user: SeedUser): Promise<User> {
  const existing = await findAuthUserByEmail(user.email);

  if (existing) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
      user_metadata: { displayName: user.displayName },
    });
    if (error || !data.user) {
      throw new Error(`Failed to update existing Supabase user ${user.email}: ${error?.message}`);
    }
    return data.user;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { displayName: user.displayName },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create Supabase user ${user.email}: ${error?.message}`);
  }
  return data.user;
}

async function ensureProfile(userId: string, displayName: string) {
  await prisma.profile.upsert({
    where: { id: userId },
    update: { displayName },
    create: { id: userId, displayName },
  });
}

async function upsertTestTable(hostUserId: string, guestUserId: string) {
  const table = await prisma.table.upsert({
    where: { inviteCode: TEST_TABLE.inviteCode },
    update: {
      hostUserId,
      name: TEST_TABLE.name,
      maxPlayers: TEST_TABLE.maxPlayers,
      smallBlind: TEST_TABLE.smallBlind,
      bigBlind: TEST_TABLE.bigBlind,
      status: TEST_TABLE.status,
    },
    create: {
      id: randomUUID(),
      inviteCode: TEST_TABLE.inviteCode,
      hostUserId,
      name: TEST_TABLE.name,
      maxPlayers: TEST_TABLE.maxPlayers,
      smallBlind: TEST_TABLE.smallBlind,
      bigBlind: TEST_TABLE.bigBlind,
      status: TEST_TABLE.status,
    },
  });

  const seats = [
    { seatIndex: 0, userId: hostUserId },
    { seatIndex: 1, userId: guestUserId },
  ];

  for (const seat of seats) {
    await prisma.seat.upsert({
      where: { tableId_seatIndex: { tableId: table.id, seatIndex: seat.seatIndex } },
      update: { userId: seat.userId, stack: 1000, isSittingOut: false },
      create: {
        tableId: table.id,
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        stack: 1000,
        isSittingOut: false,
      },
    });
  }

  return table;
}

function buildTestToken(userId: string, email: string) {
  if (!SUPABASE_JWT_SECRET) return null;

  return jwt.sign(
    {
      sub: userId,
      email,
      role: "authenticated",
      aud: "authenticated",
    },
    SUPABASE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "7d" }
  );
}

async function main() {
  console.log("Seeding Supabase auth users and Prisma profiles for tests...");

  const seededUsers = [] as Array<SeedUser & { id: string; token: string | null }>;

  for (const user of TEST_USERS) {
    const authUser = await ensureAuthUser(user);
    await ensureProfile(authUser.id, user.displayName);

    seededUsers.push({ ...user, id: authUser.id, token: buildTestToken(authUser.id, user.email) });
  }

  const table = await upsertTestTable(seededUsers[0].id, seededUsers[1].id);

  console.log("Seed complete. Use the following credentials in automated tests:");
  for (const user of seededUsers) {
    console.log(`- ${user.displayName} <${user.email}> (id: ${user.id})`);
    console.log(`  password: ${user.password}`);
    if (user.token) console.log(`  jwt: ${user.token}`);
  }
  console.log(`- Test table: ${TEST_TABLE.name} (invite code: ${TEST_TABLE.inviteCode}, id: ${table.id})`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
