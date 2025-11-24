import { describe, it, expect } from "vitest";
import { initTableState } from "../../../src/engine/state-helpers";
import { startHand, applyPlayerAction, advanceIfReady } from "../../../src/engine";

describe("all-in call heads-up still proceeds to showdown", () => {
  it("does not end hand immediately when SB all-ins for call amount", () => {
    let state = initTableState({
      tableId: "t1",
      maxPlayers: 6,
      smallBlind: 5,
      bigBlind: 10,
      seats: [
        { seatIndex: 0, userId: "p1", displayName: "P1", stack: 1000, isSittingOut: false },
        { seatIndex: 1, userId: "p2", displayName: "P2", stack: 5, isSittingOut: false },
      ],
    });

    // Start hand (p0 dealer, p1 SB=5 auto-posted, p0 BB=10 auto-posted)
    const start = startHand(state);
    state = start.state;

    // SB (seat 1) to act: call remaining 5, goes all-in
    const callAmount = state.currentHand!.callAmount;
    applyPlayerAction(state, 1, { action: "CALL", amount: callAmount });

    // Betting round should be complete; advance should move to flop, not end hand
    const adv = advanceIfReady(state);
    expect(adv).not.toBeNull();
    expect(adv!.events.map((e) => e.type)).not.toContain("HAND_COMPLETE");
    expect(adv!.state.currentHand?.street).toBe("FLOP");
  });
});
