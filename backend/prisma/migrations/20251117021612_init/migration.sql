-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- Note: Add foreign key to auth.users manually:
-- ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- CreateTable
CREATE TABLE "tables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "max_players" INTEGER NOT NULL,
    "small_blind" INTEGER NOT NULL,
    "big_blind" INTEGER NOT NULL,
    "status" TEXT NOT NULL CHECK (status IN ('OPEN', 'IN_GAME', 'CLOSED')),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_id" UUID NOT NULL,
    "seat_index" INTEGER NOT NULL,
    "user_id" UUID,
    "stack" INTEGER NOT NULL DEFAULT 0,
    "is_sitting_out" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_id" UUID NOT NULL,
    "hand_number" BIGINT NOT NULL,
    "dealer_seat_index" INTEGER NOT NULL,
    "small_blind_seat_index" INTEGER NOT NULL,
    "big_blind_seat_index" INTEGER NOT NULL,
    "community_cards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL CHECK (status IN ('DEALING', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'COMPLETE')),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "hands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_hands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hand_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seat_index" INTEGER NOT NULL,
    "hole_cards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "net_chips" INTEGER NOT NULL,
    "vpip_flag" BOOLEAN NOT NULL DEFAULT false,
    "pfr_flag" BOOLEAN NOT NULL DEFAULT false,
    "saw_showdown" BOOLEAN NOT NULL DEFAULT false,
    "won_showdown" BOOLEAN NOT NULL DEFAULT false,
    "final_hand_rank" TEXT,

    CONSTRAINT "player_hands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hand_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hand_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seat_index" INTEGER NOT NULL,
    "street" TEXT NOT NULL CHECK (street IN ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
    "action_type" TEXT NOT NULL CHECK (action_type IN ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN')),
    "amount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "hand_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seat_index" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profiles_display_name_idx" ON "profiles"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "tables_invite_code_key" ON "tables"("invite_code");

-- CreateIndex
CREATE INDEX "tables_host_user_id_idx" ON "tables"("host_user_id");

-- CreateIndex
CREATE INDEX "seats_table_id_idx" ON "seats"("table_id");

-- CreateIndex
CREATE INDEX "seats_user_id_idx" ON "seats"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seats_table_id_seat_index_key" ON "seats"("table_id", "seat_index");

-- CreateIndex
CREATE INDEX "hands_table_id_idx" ON "hands"("table_id");

-- CreateIndex
CREATE INDEX "hands_status_idx" ON "hands"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hands_table_id_hand_number_key" ON "hands"("table_id", "hand_number");

-- CreateIndex
CREATE INDEX "player_hands_user_id_idx" ON "player_hands"("user_id");

-- CreateIndex
CREATE INDEX "player_hands_table_id_idx" ON "player_hands"("table_id");

-- CreateIndex
CREATE INDEX "player_hands_hand_id_idx" ON "player_hands"("hand_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_hands_hand_id_user_id_key" ON "player_hands"("hand_id", "user_id");

-- CreateIndex
CREATE INDEX "hand_actions_hand_id_idx" ON "hand_actions"("hand_id");

-- CreateIndex
CREATE INDEX "hand_actions_user_id_idx" ON "hand_actions"("user_id");

-- CreateIndex
CREATE INDEX "hand_actions_table_id_idx" ON "hand_actions"("table_id");

-- CreateIndex
CREATE INDEX "chat_messages_table_id_created_at_idx" ON "chat_messages"("table_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages"("user_id");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hands" ADD CONSTRAINT "hands_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_hands" ADD CONSTRAINT "player_hands_hand_id_fkey" FOREIGN KEY ("hand_id") REFERENCES "hands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_hands" ADD CONSTRAINT "player_hands_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_hands" ADD CONSTRAINT "player_hands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_hand_id_fkey" FOREIGN KEY ("hand_id") REFERENCES "hands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
