# Bug: Postflop betting round never completes when all players check

## Summary
After the flop (and later streets), players can check back and forth indefinitely. The betting round never advances to the next street or showdown when no bets are made.

## Root Cause
- `engine.isBettingRoundComplete` is supposed to detect that a betting round with no bets is complete once action returns to the starting player.
- The current implementation only marks an all-check round complete when `hand.betting.lastAggressorSeatIndex` is defined **or** when `hand.toActSeatIndex` becomes `undefined`.
- In an all-check scenario with multiple active players, `lastAggressorSeatIndex` remains `undefined`, and `hand.toActSeatIndex` is always set to the next active seat by `getNextToAct` (never `undefined`). As a result, the completion condition is never met and `advanceIfReady` never advances the street.

## Proposed Fix
Track the first-to-act seat for each betting round and mark the round complete when action returns to that seat with `currentBet === 0`. Implementation ideas:
1) Store `roundFirstToActSeatIndex` in `hand.betting` inside `resetBettingRound`, and in `isBettingRoundComplete` return true when `currentBet === 0` and `hand.toActSeatIndex === roundFirstToActSeatIndex`.
2) Alternatively, when `currentBet === 0` and the next seat to act is the pre-round first actor, treat it as complete.

## Acceptance Criteria
- Given 2+ active players on flop/turn/river, after each player checks once with no bets, the engine advances to the next street (or showdown on river) automatically.
- No infinite check loops: the table state progresses without manual intervention.
- Unit test covers an all-check flop round (and river) verifying `advanceIfReady` progresses.
- No regressions to existing bet/raise/call flows (existing tests still pass).
