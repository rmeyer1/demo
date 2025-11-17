## `/docs/architecture/database-schema.md`

````md
# Database Schema (Supabase Postgres)

This document defines the **relational schema** for the Texas Hold'em Home Game platform, using **Supabase Postgres** as the database.

> Note: **Authentication users** live in `auth.users` (Supabase-managed).  
> We create a separate `profiles` table to store app-specific user metadata.

---

## 1. Overview of Tables

- `profiles` – app-level user profile data (linked to `auth.users`)
- `tables` – poker tables (home games)
- `seats` – seating assignments and chip stacks at tables
- `hands` – per-hand metadata at a table
- `player_hands` – per-player stats within a specific hand
- `hand_actions` – detailed action log for each hand (for history and metrics)
- `chat_messages` – table-scoped chat messages

Optional future tables (not required for V1, but can be added later):

- `table_invites`
- `user_stats` (aggregated stats cache)

---

## 2. Profiles

App-specific user profile, separate from Supabase `auth.users`.

### Table: `profiles`

- **Columns**
  - `id` **uuid** `PRIMARY KEY`
    - FK → `auth.users.id`
  - `display_name` **text** `NOT NULL`
  - `created_at` **timestamptz** `NOT NULL DEFAULT now()`
  - `updated_at` **timestamptz** `NOT NULL DEFAULT now()`

- **Notes**
  - The application uses `profiles.display_name` to show player name at tables.
  - The `id` is always identical to the Supabase user id.

**Example DDL**

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_display_name_idx
  on public.profiles (display_name);
````

---

## 3. Tables (Poker Tables)

Represents a poker table (home game instance).

### Table: `tables`

* **Columns**

  * `id` **uuid** `PRIMARY KEY` `DEFAULT gen_random_uuid()`
  * `host_user_id` **uuid** `NOT NULL`

    * FK → `profiles.id`
  * `name` **text** `NOT NULL`
  * `invite_code` **text** `UNIQUE NOT NULL`

    * Short code or slug to join table
  * `max_players` **integer** `NOT NULL` (e.g., 2–9)
  * `small_blind` **integer** `NOT NULL`
  * `big_blind` **integer** `NOT NULL`
  * `status` **text** `NOT NULL`

    * Enum-like: `'OPEN' | 'IN_GAME' | 'CLOSED'`
  * `created_at` **timestamptz** `NOT NULL DEFAULT now()`
  * `updated_at` **timestamptz** `NOT NULL DEFAULT now()`

* **Indexes**

  * `tables_host_user_id_idx` on `host_user_id`
  * `tables_invite_code_idx` unique on `invite_code`

**Example DDL**

```sql
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  max_players int not null,
  small_blind int not null,
  big_blind int not null,
  status text not null check (status in ('OPEN', 'IN_GAME', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tables_host_user_id_idx on public.tables (host_user_id);
```

---

## 4. Seats

Represents a physical seat at a table and which user (if any) sits there.

### Table: `seats`

* **Columns**

  * `id` **uuid** `PRIMARY KEY` `DEFAULT gen_random_uuid()`
  * `table_id` **uuid** `NOT NULL`

    * FK → `tables.id` `ON DELETE CASCADE`
  * `seat_index` **integer** `NOT NULL`

    * 0..(`max_players` - 1)
  * `user_id` **uuid** `NULL`

    * FK → `profiles.id` (`NULL` = empty seat)
  * `stack` **integer** `NOT NULL DEFAULT 0`

    * Current chip stack at the table
  * `is_sitting_out` **boolean** `NOT NULL DEFAULT false`
  * `created_at` **timestamptz** `NOT NULL DEFAULT now()`
  * `updated_at` **timestamptz** `NOT NULL DEFAULT now()`

* **Constraints**

  * Unique `(table_id, seat_index)`

**Example DDL**

```sql
create table public.seats (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  seat_index int not null,
  user_id uuid references public.profiles (id) on delete set null,
  stack int not null default 0,
  is_sitting_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seats_table_seat_unique unique (table_id, seat_index)
);

create index seats_table_id_idx on public.seats (table_id);
create index seats_user_id_idx on public.seats (user_id);
```

---

## 5. Hands

Each row represents one Texas Hold’em hand at a given table.

### Table: `hands`

* **Columns**

  * `id` **uuid** `PRIMARY KEY` `DEFAULT gen_random_uuid()`
  * `table_id` **uuid** `NOT NULL`

    * FK → `tables.id` `ON DELETE CASCADE`
  * `hand_number` **bigint** `NOT NULL`

    * Sequential per table (1, 2, 3, …)
  * `dealer_seat_index` **integer** `NOT NULL`
  * `small_blind_seat_index` **integer** `NOT NULL`
  * `big_blind_seat_index` **integer** `NOT NULL`
  * `community_cards` **text[]** `NOT NULL DEFAULT '{}'`

    * Format example: `['Ah','Kd','7s','2c','9h']`
  * `status` **text** `NOT NULL`

    * Enum-like: `'DEALING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'COMPLETE'`
  * `created_at` **timestamptz** `NOT NULL DEFAULT now()`
  * `completed_at` **timestamptz** `NULL`

* **Constraints**

  * Unique `(table_id, hand_number)`

**Example DDL**

```sql
create table public.hands (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  hand_number bigint not null,
  dealer_seat_index int not null,
  small_blind_seat_index int not null,
  big_blind_seat_index int not null,
  community_cards text[] not null default '{}',
  status text not null check (status in (
    'DEALING','PREFLOP','FLOP','TURN','RIVER','SHOWDOWN','COMPLETE'
  )),
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint hands_table_hand_number_unique unique (table_id, hand_number)
);

create index hands_table_id_idx on public.hands (table_id);
create index hands_status_idx on public.hands (status);
```

---

## 6. Player Hands

Per-player snapshot within a specific hand, used for metrics and hand history.

### Table: `player_hands`

* **Columns**

  * `id` **uuid** `PRIMARY KEY` `DEFAULT gen_random_uuid()`
  * `hand_id` **uuid** `NOT NULL`

    * FK → `hands.id` `ON DELETE CASCADE`
  * `table_id` **uuid** `NOT NULL`

    * FK → `tables.id` `ON DELETE CASCADE`
  * `user_id` **uuid** `NOT NULL`

    * FK → `profiles.id` `ON DELETE CASCADE`
  * `seat_index` **integer** `NOT NULL`
  * `hole_cards` **text[]** `NULL`

    * Format: `['As','Qs']` (optional; consider privacy/encryption later)
  * `net_chips` **integer** `NOT NULL`

    * Chips won (+) or lost (−) in this hand
  * `vpip_flag` **boolean** `NOT NULL DEFAULT false`
  * `pfr_flag` **boolean** `NOT NULL DEFAULT false`
  * `saw_showdown` **boolean** `NOT NULL DEFAULT false`
  * `won_showdown` **boolean** `NOT NULL DEFAULT false`
  * `final_hand_rank` **text** `NULL`

    * Example: `'FULL_HOUSE'`, `'FLUSH'`, etc.

* **Constraints**

  * Unique `(hand_id, user_id)`

**Example DDL**

```sql
create table public.player_hands (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references public.hands (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat_index int not null,
  hole_cards text[] null,
  net_chips int not null,
  vpip_flag boolean not null default false,
  pfr_flag boolean not null default false,
  saw_showdown boolean not null default false,
  won_showdown boolean not null default false,
  final_hand_rank text null,
  constraint player_hands_hand_user_unique unique (hand_id, user_id)
);

create index player_hands_user_id_idx on public.player_hands (user_id);
create index player_hands_table_id_idx on public.player_hands (table_id);
create index player_hands_hand_id_idx on public.player_hands (hand_id);
```

---

## 7. Hand Actions

Detailed action log for each hand (for replays and advanced analytics).

### Table: `hand_actions`

* **Columns**

  * `id` **uuid** `PRIMARY KEY` `DEFAULT gen_random_uuid()`
  * `hand_id` **uuid** `NOT NULL`

    * FK → `hands.id` `ON DELETE CASCADE`
  * `table_id` **uuid** `NOT NULL`

    * FK → `tables.id` `ON DELETE CASCADE`
  * `user_id` **uuid** `NOT NULL`

    * FK → `profiles.id` `ON DELETE CASCADE`
  * `seat_index` **integer** `NOT NULL`
  * `street` **text** `NOT NULL`

    * `'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER'`
  * `action_type` **text** `NOT NULL`

    * `'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN'`
  * `amount` **integer** `NOT NULL DEFAULT 0`

    * Chips added to the pot for this action
  * `created_at` **timestamptz** `NOT NULL DEFAULT now()`

**Example DDL**

```sql
create table public.hand_actions (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references public.hands (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat_index int not null,
  street text not null check (street in ('PREFLOP','FLOP','TURN','RIVER')),
  action_type text not null check (action_type in ('FOLD','CHECK','CALL','BET','RAISE','ALL_IN')),
  amount int not null default 0,
  created_at timestamptz not null default now()
);

create index hand_actions_hand_id_idx on public.hand_actions (hand_id);
create index hand_actions_user_id_idx on public.hand_actions (user_id);
create index hand_actions_table_id_idx on public.hand_actions (table_id);
```

---

## 8. Chat Messages

Per-table chat messages sent by users.

### Table: `chat_messages`

* **Columns**

  * `id` **uuid** `PRIMARY KEY` `DEFAULT gen_random_uuid()`
  * `table_id` **uuid** `NOT NULL`

    * FK → `tables.id` `ON DELETE CASCADE`
  * `user_id` **uuid** `NOT NULL`

    * FK → `profiles.id` `ON DELETE CASCADE`
  * `seat_index` **integer** `NULL`

    * Seat at time of message, if any
  * `content` **text** `NOT NULL`

    * Limited to 256 characters at app level
  * `created_at` **timestamptz** `NOT NULL DEFAULT now()`

* **Indexes**

  * Index on `(table_id, created_at)` for recent chat queries
  * Index on `user_id` for moderation / user history

**Example DDL**

```sql
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat_index int null,
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_table_id_created_at_idx
  on public.chat_messages (table_id, created_at);

create index chat_messages_user_id_idx
  on public.chat_messages (user_id);
```

---

## 9. Optional Aggregated Stats (Future)

You may add a `user_stats` table later if on-the-fly queries become slow.

### Table: `user_stats` (optional)

* `user_id` **uuid** `PRIMARY KEY`
* `total_hands` **integer**
* `net_chips` **integer**
* `vpip_hands` **integer**
* `pfr_hands` **integer**
* `showdown_wins` **integer**
* `last_updated_at` **timestamptz**

This can be updated by a background job or directly when hands complete.

---

## 10. Prisma Schema (High-Level Example)

You can represent these tables in `schema.prisma` roughly as:

```prisma
model Profile {
  id          String   @id @default(uuid())
  displayName String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now())

  tables      Table[]  @relation("HostTables")
  seats       Seat[]
  playerHands PlayerHand[]
  actions     HandAction[]
  messages    ChatMessage[]
}

model Table {
  id          String   @id @default(uuid())
  hostUserId  String
  host        Profile  @relation("HostTables", fields: [hostUserId], references: [id])
  name        String
  inviteCode  String   @unique
  maxPlayers  Int
  smallBlind  Int
  bigBlind    Int
  status      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now())

  seats       Seat[]
  hands       Hand[]
  playerHands PlayerHand[]
  actions     HandAction[]
  messages    ChatMessage[]
}

model Seat {
  id           String   @id @default(uuid())
  tableId      String
  table        Table    @relation(fields: [tableId], references: [id])
  seatIndex    Int
  userId       String?
  user         Profile? @relation(fields: [userId], references: [id])
  stack        Int      @default(0)
  isSittingOut Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @default(now())

  @@unique([tableId, seatIndex])
}

model Hand {
  id                  String   @id @default(uuid())
  tableId             String
  table               Table    @relation(fields: [tableId], references: [id])
  handNumber          BigInt
  dealerSeatIndex     Int
  smallBlindSeatIndex Int
  bigBlindSeatIndex   Int
  communityCards      String[] @db.Text
  status              String
  createdAt           DateTime @default(now())
  completedAt         DateTime?

  playerHands         PlayerHand[]
  actions             HandAction[]

  @@unique([tableId, handNumber])
}

model PlayerHand {
  id            String   @id @default(uuid())
  handId        String
  hand          Hand     @relation(fields: [handId], references: [id])
  tableId       String
  table         Table    @relation(fields: [tableId], references: [id])
  userId        String
  user          Profile  @relation(fields: [userId], references: [id])
  seatIndex     Int
  holeCards     String[]?
  netChips      Int
  vpipFlag      Boolean  @default(false)
  pfrFlag       Boolean  @default(false)
  sawShowdown   Boolean  @default(false)
  wonShowdown   Boolean  @default(false)
  finalHandRank String?

  @@unique([handId, userId])
}

model HandAction {
  id         String   @id @default(uuid())
  handId     String
  hand       Hand     @relation(fields: [handId], references: [id])
  tableId    String
  table      Table    @relation(fields: [tableId], references: [id])
  userId     String
  user       Profile  @relation(fields: [userId], references: [id])
  seatIndex  Int
  street     String
  actionType String
  amount     Int      @default(0)
  createdAt  DateTime @default(now())
}

model ChatMessage {
  id         String   @id @default(uuid())
  tableId    String
  table      Table    @relation(fields: [tableId], references: [id])
  userId     String
  user       Profile  @relation(fields: [userId], references: [id])
  seatIndex  Int?
  content    String
  createdAt  DateTime @default(now())
}
```

This schema is intentionally aligned with the DDL above; adjust as needed to match your actual Prisma provider and Supabase settings.

````

