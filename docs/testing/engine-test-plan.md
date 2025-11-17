## `/docs/testing/engine-test-plan.md`

```md
# Engine Test Plan (Vitest)

This document defines the **unit test plan** for the Texas Hold’em **Game Engine**.

Engine spec: `/docs/specs/game-engine-spec.md`  
Rules: `/docs/features/gameplay-texas-holdem.md`

All engine tests use **Vitest** and run in **Node** environment with no external dependencies (no DB, no network).

---

## 1. Scope

We test:

- Deck creation & shuffling
- Dealing hole and community cards
- Blind posting & seat rotation
- Turn order on each street
- Betting rules (min bet/raise, all-ins)
- Pot and side pot management
- Hand evaluation (all ranks, tie-breaking)
- Showdown & pot distribution
- Engine invariants (no duplicate cards, valid state transitions)

---

## 2. Test Organization

Tests live under:

```txt
/backend/tests/unit/engine/
  deck.test.ts
  dealing.test.ts
  blinds-and-seats.test.ts
  betting-preflop.test.ts
  betting-postflop.test.ts
  sidepots.test.ts
  evaluation.test.ts
  showdown.test.ts
  invariants.test.ts
````

All tests import engine types and functions from `/backend/src/engine`.

---

## 3. Deck & Dealing Tests

### 3.1 Deck Creation

* `createDeck()` returns 52 unique cards (no duplicates).
* All 4 suits × 13 ranks are present.

### 3.2 Shuffling

* `shuffleDeck()` produces a permutation of the same 52 cards.
* Multiple shuffles produce different orders (statistical check, e.g. ensure not always same).

### 3.3 Hole Cards

* Given N active players, engine deals:

  * Exactly 2 cards per player.
  * Correct dealing order (small blind → clockwise).
  * No card appears in two locations at once.

### 3.4 Community Cards

* Flop: burn 1, deal 3.
* Turn: burn 1, deal 1.
* River: burn 1, deal 1.
* All dealt cards come from the deck; no duplicates.

---

## 4. Blinds & Seat Rotation

### 4.1 Dealer Button Movement

* After each completed hand:

  * Dealer seat index moves to next occupied seat clockwise.
* Test with:

  * 6-handed table with 1 or 2 absent seats.
  * Ensure dealer skips empty seats.

### 4.2 Blind Posting

* Small blind is first seat clockwise from dealer.
* Big blind is first seat clockwise from small blind.
* Blinds deducted from stacks correctly.
* Short-stack blind:

  * Player has less than blind amount → posts all remaining chips → `ALL_IN` status.

### 4.3 Heads-Up Rules

* When 2 players:

  * Dealer is small blind.
  * Non-dealer is big blind.
  * Dealer acts first preflop; last on postflop streets.

---

## 5. Betting Logic

### 5.1 Turn Order

* Preflop:

  * Action starts left of big blind (or dealer in heads-up).
* Postflop (flop/turn/river):

  * Action starts left of dealer.
* Tests:

  * Sequence of `PLAYER_ACTION`s leads to correct `toActSeatIndex`.

### 5.2 Allowed Actions

* `CHECK` only when `callAmount = 0`.
* `CALL` only when `callAmount > 0`.
* `BET` only when no bet yet on street (no current bet).
* `RAISE` only when there is an existing bet.
* Attempting illegal actions results in engine error (or appropriate error code).

### 5.3 Minimum Bet / Raise

* Preflop:

  * Minimum bet/raise ≥ big blind.
* Postflop:

  * Minimum raise size is at least the last full raise size.
* All-ins:

  * Short all-in < min raise does **not** reopen betting for players who have already acted.

Write tests that:

* Try to raise less than allowed → expect error.
* All-in smaller than min raise → allowed as call/all-in but doesn’t reopen.

---

## 6. All-In & Side Pots

### 6.1 Single All-In

* Scenario:

  * Player A: 100 chips, Player B: 500 chips, Player C: 1000 chips.
  * A goes all-in, B calls, C calls.
* Expected:

  * Main pot: 300 (100 × 3).
  * Side pot(s) empty or only if more betting occurs.

### 6.2 Multiple All-Ins

* Scenario:

  * A: 100, B: 300, C: 1000.
  * All three go all-in or call.
* Expected:

  * Main pot: 300 (100 × 3).
  * Side pot 1: 400 (200 × 2 for B and C).
  * Further side pots if extra betting.

### 6.3 Mixed All-In During Street

* Test:

  * Player goes all-in for raise amount smaller than min raise.
  * Others call or fold.
  * Validate pot breakdown and eligible players per pot.

---

## 7. Hand Evaluation

### 7.1 Hand Categories

For each category, construct explicit test cases:

* High Card
* One Pair
* Two Pair
* Three of a Kind
* Straight (including A-5 wheel, A-high)
* Flush
* Full House
* Four of a Kind
* Straight Flush
* Royal Flush

Each test should:

* Provide 7 cards (2 hole + 5 board).
* Assert computed `category` matches expected.

### 7.2 Tie-Breaking

Tests:

* Same Hand Category:

  * Compare primary ranks:

    * Example: Straight Q-high vs J-high.
  * Compare kickers:

    * Example: Top pair same rank, different kickers.
* Exact ties:

  * Two players with identical 5-card hand → split pot.

---

## 8. Showdown & Pot Distribution

### 8.1 Single Pot, Single Winner

* Multiple players, one winner.
* Winner’s stack increases by full pot minus their invest amount (implicit in net_chips).

### 8.2 Single Pot, Split Pot

* Two players with identical best hand.
* Pot split evenly.
* 1-chip remainder:

  * Given to earliest seat clockwise from dealer among winners (per spec).

### 8.3 Side Pots with Winners

* Construct scenario:

  * Multiple side pots.
  * Player A eligible only for main pot.
  * Player B & C eligible for side pot.
* Validate:

  * Main pot winner only includes eligible players.
  * Side pot winner only from those who contributed.

---

## 9. Invariants

For every public engine method, include tests that assert:

* No duplicate cards across:

  * `deck`
  * `burnedCards`
  * `communityCards`
  * `holeCards`
* Only one active hand per table.
* Only the `toActSeatIndex` can act.
* Pot and stack sums remain consistent:

  * (Total initial chips + chips added via rebuys, etc.) = (sum of stacks + pots), before and after each action.

---

## 10. Test Execution

From `/backend`:

```bash
npm run test:engine
```

Example script in `package.json`:

```json
{
  "scripts": {
    "test:engine": "vitest run tests/unit/engine"
  }
}
```

Engine tests must remain **fast** and side-effect free, suitable for running on every commit.

````

---