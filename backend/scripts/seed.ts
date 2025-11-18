import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USERS = [
  { id: "11111111-1111-1111-1111-111111111111", displayName: "Alice Demo" },
  { id: "22222222-2222-2222-2222-222222222222", displayName: "Bob Demo" },
] as const;

const DEMO_TABLE = {
  inviteCode: "DEMO123",
  name: "Demo Home Game",
  maxPlayers: 6,
  smallBlind: 5,
  bigBlind: 10,
  status: "OPEN" as const,
};

async function upsertProfiles() {
  for (const user of DEMO_USERS) {
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { displayName: user.displayName },
      create: { id: user.id, displayName: user.displayName },
    });
  }
}

async function upsertTable() {
  return prisma.table.upsert({
    where: { inviteCode: DEMO_TABLE.inviteCode },
    update: {
      hostUserId: DEMO_USERS[0].id,
      name: DEMO_TABLE.name,
      maxPlayers: DEMO_TABLE.maxPlayers,
      smallBlind: DEMO_TABLE.smallBlind,
      bigBlind: DEMO_TABLE.bigBlind,
      status: DEMO_TABLE.status,
    },
    create: {
      id: randomUUID(),
      inviteCode: DEMO_TABLE.inviteCode,
      hostUserId: DEMO_USERS[0].id,
      name: DEMO_TABLE.name,
      maxPlayers: DEMO_TABLE.maxPlayers,
      smallBlind: DEMO_TABLE.smallBlind,
      bigBlind: DEMO_TABLE.bigBlind,
      status: DEMO_TABLE.status,
    },
  });
}

async function upsertSeats(tableId: string) {
  const seats = [
    { seatIndex: 0, userId: DEMO_USERS[0].id, stack: 1000 },
    { seatIndex: 1, userId: DEMO_USERS[1].id, stack: 1000 },
  ];

  for (const seat of seats) {
    await prisma.seat.upsert({
      where: {
        tableId_seatIndex: { tableId, seatIndex: seat.seatIndex },
      },
      update: {
        userId: seat.userId,
        stack: seat.stack,
        isSittingOut: false,
      },
      create: {
        tableId,
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        stack: seat.stack,
        isSittingOut: false,
      },
    });
  }
}

async function main() {
  console.log("Seeding demo data...");
  await upsertProfiles();
  const table = await upsertTable();
  await upsertSeats(table.id);

  console.log("Seed complete:");
  console.log(`- Users: ${DEMO_USERS.map((u) => `${u.displayName} (${u.id})`).join(", ")}`);
  console.log(`- Table: ${table.name} (invite code: ${table.inviteCode}, id: ${table.id})`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
