---

## ✅ `/docs/specs/game-engine-spec.md`

````md
# Game Engine Specification (Authoritative Contract)

This document defines the **strict TypeScript contract** for the **Texas Hold'em Game Engine**.

Agents implementing the engine **must** conform to these interfaces and invariants.

### Host-driven game start (UI)

- The table does not auto-start when only two players are present; the host can manually trigger the first hand.
- When the host is seated with chips, at least one other non-sitting-out player is seated with chips, and no hand is active, the host sees a red **Start** button on their seat card (replaces the "Sit Here" CTA slot).
- Clicking **Start** emits `GAME_START`; the button disables while the request is in-flight and re-enables once the next `TABLE_STATE` arrives or an error is returned over the `ERROR` channel.
- If conditions drop below two ready players or a hand is running, the Start button disappears.

---

## 1. Design Goals

- The engine is **pure logic**, implemented in **TypeScript**.
- It must:
  - Maintain table + hand state.
  - Apply actions.
  - Advance streets and hands.
  - Evaluate winners and produce pot distributions.
- It must **NOT**:
  - Access the database.
  - Make network calls.
  - Talk directly to WebSockets.

The integration layer calls engine functions and then:
- Persists the new state.
- Sends events to clients over WebSockets.

---

## 2. Basic Types

```ts
export type UserId = string;
export type TableId = string;
export type HandId = string;
export type SeatIndex = number; // 0..N-1
export type ChipAmount = number; // integer, >= 0

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "T" | "J" | "Q" | "K" | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";

export type TableStatus = "WAITING_FOR_PLAYERS" | "IN_HAND" | "PAUSED";

export type PlayerStatus =
  | "ACTIVE"      // still in hand, can act (unless all-in)
  | "FOLDED"      // folded out of current hand
  | "ALL_IN"      // no more chips, cannot act, eligible for pots
  | "SITTING_OUT";// not currently participating in hand
````

### 2.1 Hand Ranking Types

```ts
export type HandRankCategory =
  | "HIGH_CARD"
  | "ONE_PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH"
  | "ROYAL_FLUSH";

export interface EvaluatedHand {
  category: HandRankCategory;
  /**
   * For tie-breaking:
   * A lexicographically comparable numeric vector:
   * [categoryValue, primaryRankValue, kicker1, kicker2, ...]
   */
  scoreVector: number[];
}
```

---

## 3. Table & Hand State

### 3.1 Seats & Pots

```ts
export interface PlayerSeat {
  seatIndex: SeatIndex;
  userId: UserId | null;
  displayName: string | null;
  stack: ChipAmount;        // current chips in front of player
  status: PlayerStatus;     // ACTIVE/FOLDED/ALL_IN/SITTING_OUT
}

export interface Pot {
  potId: number;
  amount: ChipAmount;
  /**
   * Eligible winners: players who contributed to this pot.
   */
  eligibleSeatIndices: SeatIndex[];
}
```

### 3.2 Betting Round State

```ts
export interface BettingRoundState {
  street: Street;                      // PREFLOP/FLOP/TURN/RIVER
  currentBet: ChipAmount;              // highest bet this street
  minRaise: ChipAmount;                // minimum raise (per rules)
  lastAggressorSeatIndex?: SeatIndex;  // last player to bet/raise
  toActSeatIndex?: SeatIndex;          // whose turn it is, if any

  /**
   * Contributions on this street only, per seat.
   * For example, preflop: includes blinds + calls/raises.
   */
  contributions: Record<SeatIndex, ChipAmount>;
}
```

### 3.3 Hand State

```ts
export interface ShowdownResult {
  winners: {
    seatIndex: SeatIndex;
    hand: EvaluatedHand;
    wonAmount: ChipAmount;
  }[];
}

export interface HandState {
  handId: HandId;
  tableId: TableId;

  dealerSeatIndex: SeatIndex;
  smallBlindSeatIndex: SeatIndex;
  bigBlindSeatIndex: SeatIndex;

  deck: Card[];            // remaining cards in deck
  burnedCards: Card[];

  communityCards: Card[];

  // Hole cards per seat. Only engine sees all of this.
  holeCards: Record<SeatIndex, [Card, Card] | undefined>;

  mainPot: Pot;
  sidePots: Pot[];

  betting: BettingRoundState;

  street: Street;
  isHandOver: boolean;

  showdownResults?: ShowdownResult;
}
```

### 3.4 Table State

```ts
export interface TableConfig {
  tableId: TableId;
  maxPlayers: number;
  smallBlind: ChipAmount;
  bigBlind: ChipAmount;
}

export interface TableState {
  config: TableConfig;
  seats: PlayerSeat[];
  status: TableStatus;

  activeHand: HandState | null;

  /**
   * For rotating the dealer button.
   * null if no hands have been played yet.
   */
  lastDealerSeatIndex: SeatIndex | null;
}
```

---

## 4. Engine Inputs & Outputs

### 4.1 Player Actions

```ts
export type EngineActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE";

export interface EnginePlayerAction {
  type: "PLAYER_ACTION";
  tableId: TableId;
  handId: HandId;
  userId: UserId;
  action: EngineActionType;
  amount?: ChipAmount; // required for BET/RAISE, ignored otherwise
}
```

### 4.2 Engine Events

These are **internal events** that the integration layer can use to:

* Update DB
* Notify WebSocket clients
* Log analytics

```ts
export type EngineEventType =
  | "TABLE_STATE_UPDATED"
  | "HAND_STARTED"
  | "CARDS_DEALT"
  | "BETTING_ROUND_UPDATED"
  | "PLAYER_ACTION_APPLIED"
  | "SHOWDOWN"
  | "HAND_COMPLETED"
  | "ERROR";

export interface EngineEventBase {
  type: EngineEventType;
  tableId: TableId;
  handId?: HandId;
}
```

#### Example Events

```ts
export interface HandStartedEvent extends EngineEventBase {
  type: "HAND_STARTED";
  dealerSeatIndex: SeatIndex;
  smallBlindSeatIndex: SeatIndex;
  bigBlindSeatIndex: SeatIndex;
}

export interface CardsDealtEvent extends EngineEventBase {
  type: "CARDS_DEALT";
  street: Street;               // e.g., "PREFLOP", "FLOP", "TURN", "RIVER"
  communityCards: Card[];       // all current community cards
}

export interface PlayerActionAppliedEvent extends EngineEventBase {
  type: "PLAYER_ACTION_APPLIED";
  seatIndex: SeatIndex;
  action: EngineActionType;
  amount: ChipAmount;
  betting: BettingRoundState;
  mainPot: Pot;
  sidePots: Pot[];
}

export interface ShowdownEvent extends EngineEventBase {
  type: "SHOWDOWN";
  results: ShowdownResult;
}

export interface HandCompletedEvent extends EngineEventBase {
  type: "HAND_COMPLETED";
  finalStacks: { seatIndex: SeatIndex; stack: ChipAmount }[];
}

export interface ErrorEvent extends EngineEventBase {
  type: "ERROR";
  code: string;
  message: string;
}
```

### 4.3 EngineResult Wrapper

```ts
export interface EngineResult<TState> {
  state: TState;
  events: EngineEventBase[];
}
```

---

## 5. Public Table View

The engine must be able to generate a **sanitized view** of state for a specific user.

```ts
export interface PublicPlayerSeatView {
  seatIndex: SeatIndex;
  displayName: string | null;
  stack: ChipAmount;
  status: PlayerStatus;
  isSelf: boolean;
}

export interface PublicTableView {
  tableId: TableId;
  seats: PublicPlayerSeatView[];
  communityCards: Card[];
  potTotal: ChipAmount;
  street: Street | null;
  toActSeatIndex?: SeatIndex;
  minBet?: ChipAmount;
  callAmount?: ChipAmount;

  handId?: HandId;
  holeCards?: [Card, Card]; // current user's hole cards only
}
```

---

## 6. Engine API (Functions Agents Must Implement)

All functions must be **pure**:

* They receive current state and inputs.
* They return a **new state + events**.
* They **do not mutate** input state in place.

```ts
export interface GameEngine {
  /**
   * Initialize a fresh table with no players and no active hand.
   */
  initTableState(config: TableConfig): TableState;

  /**
   * Seat a player at a given seat index with initial stack (buy-in).
   * Preconditions:
   * - No active hand OR seat is currently empty for the upcoming hand.
   */
  seatPlayer(
    state: TableState,
    seatIndex: SeatIndex,
    userId: UserId,
    displayName: string,
    buyIn: ChipAmount
  ): EngineResult<TableState>;

  /**
   * Unseat a player. May be restricted if a hand is in progress (e.g., mark as SITTING_OUT instead).
   */
  unseatPlayer(
    state: TableState,
    seatIndex: SeatIndex
  ): EngineResult<TableState>;

  /**
   * Start a new hand.
   * Preconditions:
   * - state.activeHand === null
   * - At least 2 players with positive stacks
   */
  startHand(
    state: TableState
  ): EngineResult<TableState>;

  /**
   * Apply a player betting action (fold, check, call, bet, raise).
   * Must enforce:
   * - Correct turn order
   * - Valid action given betting state
   * - Min bet/raise rules
   */
  applyPlayerAction(
    state: TableState,
    action: EnginePlayerAction
  ): EngineResult<TableState>;

  /**
   * Advance the game automatically when conditions are met:
   * - Betting round complete => deal next street
   * - Hand complete => evaluate showdown, distribute chips, finalize hand
   */
  advanceIfReady(
    state: TableState
  ): EngineResult<TableState>;

  /**
   * Generate a public table view for a specific user.
   * No hidden info is exposed (e.g. other players' hole cards).
   */
  getPublicTableView(
    state: TableState,
    userId: UserId
  ): PublicTableView;
}
```

---

## 7. Required Invariants

Engine implementations **must** maintain:

1. **Card Uniqueness**

   * A card appears in only one of:

     * `deck`
     * `burnedCards`
     * `communityCards`
     * `holeCards`

2. **Single Active Hand**

   * `state.activeHand` is either `null` or a valid `HandState`.
   * At most one active hand per table.

3. **Valid Turn**

   * Only the player indicated by `betting.toActSeatIndex` may act.
   * Players with `status` `FOLDED`, `ALL_IN`, or `SITTING_OUT` cannot act.

4. **Betting Rules**

   * No `CHECK` when facing a bet.
   * No `CALL` when `callAmount` is 0.
   * `BET`/`RAISE` respect the **minimum bet/raise** rules.
   * Pot and contribution amounts are always non-negative integers.

5. **Street Progression**

   * Streets progress in order:

     * `PREFLOP → FLOP → TURN → RIVER → SHOWDOWN`.
   * The engine does not skip streets or regress.

6. **Pot Accounting**

   * The sum of all player stacks plus all pot amounts remains consistent.
   * Side pots are created and maintained correctly based on contributions.

7. **Showdown Logic**

   * All remaining players’ hands are evaluated.
   * Only players who contributed to a pot are eligible to win that pot.
   * Pots are correctly split on ties.

---

## 8. Testing Requirements

Agents must write unit tests covering:

* Deck creation & dealing correctness.
* Preflop, flop, turn, river betting (including raises and all-ins).
* Heads-up blinds and action order.
* Side pot creation and distribution.
* Hand evaluation for all categories (royal → high card).
* Multiple tie and split scenarios.

See `/docs/testing/engine-test-plan.md` for detailed scenarios.

---

This spec is the **source of truth** for engine behavior.
The frontend, WebSocket protocol, and REST API layers must all align with these models and invariants.
