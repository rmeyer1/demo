## `/docs/features/gameplay-texas-holdem.md`

```md
# Texas Hold'em Gameplay Specification

This document defines the full set of **Texas Hold'em** rules that the Game Engine must implement. It is **authoritative** for all gameplay-related behavior.

The Game Engine is server-authoritative:
- The server shuffles the deck, deals cards, validates actions, manages pots and side pots, evaluates hands, and distributes chips.
- Clients send only **intents** (Fold, Check/Call, Bet/Raise), and the server decides if they are valid given the current state.

---

## 1. Game Setup

### 1.1 Deck

- Standard 52-card deck.
- No jokers.
- Deck is shuffled **server-side only** each hand.
- A card can only appear in **one place**: deck, burned, community, or a player’s hole cards.

### 1.2 Table & Seats

- Each table has:
  - `max_players` (e.g., 2–9).
  - A set of **seats** indexed `0..max_players-1`.
- Each seat may be:
  - Empty (no user).
  - Occupied by a player with a current **chip stack**.
- Only seated players with chips can participate in hands.
- Seats flagged **SITTING_OUT** are skipped for button movement and cannot join a hand until their status returns to `ACTIVE` before the deal.

### 1.3 Blinds & Positions

- A **dealer button** indicates the nominal dealer position.
- **Blind posting**:
  - Small blind = immediate clockwise seat from dealer.
  - Big blind = immediate clockwise seat from small blind.
- Each new hand:
  - Dealer button moves to the next occupied seat clockwise.
  - Small blind & big blind are recalculated from the dealer position.

#### Heads-Up Special Case

- When only **two players** are active at the table:
  - The **dealer posts small blind**, non-dealer posts big blind.
  - **Dealer acts first preflop**.
  - **Dealer acts last on all postflop streets**.

---

## 2. Hand Lifecycle

Each hand passes through these phases:

1. **Blinds Posting**
2. **Dealing Hole Cards**
3. **Preflop Betting Round**
4. **Flop (3 community cards) + Betting Round**
5. **Turn (1 community card) + Betting Round**
6. **River (1 community card) + Betting Round**
7. **Showdown & Pot Distribution**
8. **Hand Completion & Next Hand**

The engine must enforce that transitions occur in this order and only when betting conditions are satisfied.

### 2.1 Table start eligibility (host-triggered)

* A hand may start only when **at least two seats** have `userId`, `stack > 0`, and are **not sitting out**.
* The hosting layer (WS) is responsible for enforcing host-only start, but the engine still throws `NOT_ENOUGH_PLAYERS` if this precondition fails.
* The generated `handId` is an **opaque string** (not required to be a UUID); downstream contracts must treat it as a pass-through identifier.
* Seats taking part in a hand are immutable for that hand: standing up mid-hand is disallowed; removing a seat mid-hand would invalidate pots/turn order.

---

## 3. Blinds

### 3.1 Posting Blinds

- Small blind posts `small_blind` amount.
- Big blind posts `big_blind` amount.
- Blinds are **forced bets** taken from the players’ stacks at hand start.

### 3.2 Short Stacks

- If a blind player’s stack is **less than** the required blind:
  - They post all remaining chips and are considered **all-in** for that amount.
  - The engine must handle side pots accordingly.

---

## 4. Dealing Procedure

### 4.1 Hole Cards

- After blinds are posted, the engine deals **two hole cards** to each active player.
- Dealing order:
  - Start from the **small blind** and move clockwise.
  - Each player receives one card in the first pass and one in the second pass.
- The engine stores hole cards in state but only exposes a player’s own cards via public view.

### 4.2 Community Cards

- **Burn card** before each community dealing step:
  - Burn 1 card before the **flop**.
  - Burn 1 card before the **turn**.
  - Burn 1 card before the **river**.
- Community dealing:
  - **Flop:** Deal 3 community cards face up.
  - **Turn:** Deal 1 community card face up.
  - **River:** Deal 1 community card face up.

---

## 5. Betting Rules

All betting must follow standard **No-Limit Texas Hold’em** rules.

### 5.1 Streets (Betting Rounds)

Four betting rounds, called “streets”:

1. **Preflop**
2. **Flop**
3. **Turn**
4. **River**

### 5.2 Action Order

- Preflop:
  - Action starts with the first active player **clockwise from the big blind**.
  - In heads-up:
    - Dealer (small blind) acts first preflop.
- Postflop (Flop, Turn, River):
  - Action starts with the first active player clockwise from the **dealer**.

### 5.3 Available Actions

Depending on the current situation, a player may choose:

- `FOLD`
  - The player gives up all claim to the pot.
  - Their status becomes `FOLDED`.
- `CHECK`
  - Allowed only if the player is **not facing a bet** (call amount = 0).
- `CALL`
  - Match the current highest bet for the betting round.
- `BET`
  - Put chips into the pot when no one has yet bet on this street.
- `RAISE`
  - Increase the current bet level after a bet or raise.
- `ALL-IN`
  - All remaining chips are committed.
  - Treated as a *bet* or *raise* of the full stack, possibly creating side pots.

### 5.4 Minimum Bet / Raise Rules

- **Preflop and Flop**:
  - Initial minimum bet/raise amount is at least the size of the **big blind**.
- **Turn and River**:
  - Same as flop: minimum bet/raise is at least the **big blind**, and for raises:
    - Minimum raise size must be **at least equal to the last full raise size**.
- If a raise is **less than the minimum** due to a short stack (all-in), it is:
  - A valid **all-in**, but may **not reopen** the betting for players who already acted, depending on table rules (we use the common “short all-in doesn’t reopen” rule for simplicity).

### 5.5 End of Betting Round

A betting round ends when:

- All **non-folded, non-all-in** players:
  - Have **matched the highest bet** for that street, or
  - There is only **one player remaining** (everyone else has folded).

Once the betting round is complete, if:

- More than one player remains and there are streets left:
  - Advance to the next street (deal more community cards).
- Only one player remains:
  - That player wins immediately; no showdown needed.

---

## 6. All-In & Side Pots

### 6.1 All-In

- A player may go all-in at any time with their remaining stack.
- If an all-in is **less than** the current bet or raise size, that player:
  - Can still contest the pot for the amount they’ve contributed.
  - May cause the creation of side pots.

### 6.2 Pot Management

The engine must track multiple pots:

- **Main Pot**
  - Contains contributions from all players up to the smallest all-in amount among players contesting that pot.
- **Side Pots**
  - Created when a player goes all-in with a smaller stack than others who continue betting.
  - Each side pot has a set of **eligible players** (only players who contributed chips to that pot can win it).

### 6.3 Pot Distribution Rules

- At showdown:
  - Evaluate remaining players’ hands.
  - For each pot (main and side pots):
    - Among **eligible** players for that pot, determine the best hand(s).
    - Award the pot to the best hand.
    - If multiple players tie, **split the pot** as evenly as possible.
      - Any chip that cannot be split evenly (1-chip remainder) follows standard rounding / house rule (for V1, give remainder to earliest seat clockwise from the dealer among winners).

---

## 7. Showdown & Hand Evaluation

### 7.1 When Showdown Occurs

A showdown occurs when:

- After the final betting round (river), there are **two or more** players still active (not folded).
- Or, all-in situations where:
  - One or more players are all-in, no further betting possible, and community cards must be dealt out.

### 7.2 Hand Construction

For each remaining player:

- Best hand is formed from **7 cards**:
  - 2 hole cards.
  - 5 community cards.
- The engine must evaluate all combinations and choose the **best 5-card poker hand**.

### 7.3 Hand Ranking Order (High to Low)

1. **Royal Flush**  
   - Ten, Jack, Queen, King, Ace, all same suit.
2. **Straight Flush**  
   - Any 5 consecutive cards of the same suit (not Royal).
3. **Four of a Kind**
4. **Full House** (Three of a kind + a pair)
5. **Flush** (5 cards same suit, non-consecutive)
6. **Straight** (5 consecutive cards, mixed suits)
7. **Three of a Kind**
8. **Two Pair**
9. **One Pair**
10. **High Card**

### 7.4 Tie-Breaking

The engine must support detailed tie-breaking for each category:

- Compare primary rank(s) (e.g., highest card in a straight).
- If equal, compare kickers in descending order.
- If all ranks are equal, hands are a tie and the relevant pot is split.

The engine should represent hand strengths internally via an `EvaluatedHand` structure with a **score vector** that can be lexicographically compared.

---

## 8. Hand Completion & Next Hand

### 8.1 End-of-Hand State Updates

After the pot(s) are distributed:

- Update each player’s **stack**.
- Record per-hand metrics for dashboard:
  - `net_chips` for each player.
  - `vpip_flag`, `pfr_flag`, `saw_showdown`, `won_showdown`.
- Mark the hand as `COMPLETE`.

### 8.2 Dealer Rotation

- Move the dealer button to the next occupied seat clockwise.
- Recalculate small and big blind positions accordingly for the next hand.

### 8.3 Starting Next Hand

The table can automatically start the next hand if:

- At least **two players** have a positive stack.
- The table is not paused or closed.

If fewer than two players have chips:

- The table may:
  - Enter `WAITING_FOR_PLAYERS` state, or
  - Be marked `CLOSED` depending on product behavior.

---

## 9. Engine Invariants

The engine must always maintain:

- No duplicated cards across deck/burned/community/hole cards.
- Exactly **one** active hand per table (or none).
- Only the player whose turn it is can perform action.
- All transitions are valid per the rules above.
- All chip accounting:
  - Sum of all stacks + all pots remains consistent.

For implementation details and the engine interface, see:
`/docs/specs/game-engine-spec.md`.
```
