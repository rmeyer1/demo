import { describe, it, expect } from "vitest";
import { advanceIfReady, applyPlayerAction, startHand } from "../../../src/engine";
import { initTableState } from "../../../src/engine/state-helpers";

function setupTable(twoPlayers = true) {
  const seats = [
    { seatIndex: 0, userId: "p1", displayName: "P1", stack: 1000, isSittingOut: false },
    { seatIndex: 1, userId: "p2", displayName: "P2", stack: 1000, isSittingOut: false },
    { seatIndex: 2, userId: null, displayName: "Empty", stack: 0, isSittingOut: true },
  ];
  const state = initTableState({
    tableId: "t1",
    maxPlayers: 6,
    smallBlind: 5,
    bigBlind: 10,
    seats: twoPlayers ? seats.slice(0, 2) : seats,
  });
  return state;
}

describe("advanceIfReady with all checks postflop", () => {
  it("advances from flop to turn when everyone checks once", () => {
    let state = setupTable();
    // start hand
    let result = startHand(state);
    state = result.state;

    // Jump to flop state and simulate everyone checked back to the first actor
    state.currentHand!.street = "FLOP";
    state.currentHand!.betting.street = "FLOP";
    state.currentHand!.communityCards = [
      { rank: "A", suit: "♠" },
      { rank: "K", suit: "♣" },
      { rank: "Q", suit: "♦" },
    ] as any;
    state.currentHand!.betting.roundFirstToActSeatIndex = 0;
    state.currentHand!.toActSeatIndex = 0;
    state.currentHand!.betting.toActSeatIndex = 0;
    state.currentHand!.callAmount = 0;
    state.currentHand!.betting.currentBet = 0;
    let adv = advanceIfReady(state);

    expect(adv).not.toBeNull();
    expect(adv!.state.currentHand?.street).toBe("TURN");
  });

  it("advances to showdown on river when everyone checks", () => {
    let state = setupTable();
    let result = startHand(state);
    state = result.state;

    // Flop complete by all checks
    state.currentHand!.street = "FLOP";
    state.currentHand!.betting.street = "FLOP";
    state.currentHand!.betting.roundFirstToActSeatIndex = 0;
    state.currentHand!.toActSeatIndex = 0;
    state.currentHand!.betting.toActSeatIndex = 0;
    state.currentHand!.callAmount = 0;
    state.currentHand!.betting.currentBet = 0;
    let adv = advanceIfReady(state);
    state = adv!.state; // turn

    // Turn complete by all checks
    state.currentHand!.street = "TURN";
    state.currentHand!.betting.street = "TURN";
    state.currentHand!.communityCards = [
      { rank: "A", suit: "♠" },
      { rank: "K", suit: "♣" },
      { rank: "Q", suit: "♦" },
      { rank: "J", suit: "♠" },
    ] as any;
    state.currentHand!.betting.roundFirstToActSeatIndex = 0;
    state.currentHand!.toActSeatIndex = 0;
    state.currentHand!.betting.toActSeatIndex = 0;
    state.currentHand!.callAmount = 0;
    state.currentHand!.betting.currentBet = 0;
    adv = advanceIfReady(state);
    state = adv!.state; // river

    // River complete by all checks
    state.currentHand!.street = "RIVER";
    state.currentHand!.betting.street = "RIVER";
    state.currentHand!.communityCards = [
      { rank: "A", suit: "♠" },
      { rank: "K", suit: "♣" },
      { rank: "Q", suit: "♦" },
      { rank: "J", suit: "♠" },
      { rank: "T", suit: "♥" },
    ] as any;
    state.currentHand!.betting.roundFirstToActSeatIndex = 0;
    state.currentHand!.toActSeatIndex = 0;
    state.currentHand!.betting.toActSeatIndex = 0;
    state.currentHand!.callAmount = 0;
    state.currentHand!.betting.currentBet = 0;
    adv = advanceIfReady(state);

    expect(adv).not.toBeNull();
    const events = adv!.events.map((e) => e.type);
    expect(events).toContain("HAND_COMPLETE");
    expect(adv!.state.currentHand).toBeUndefined();
  });
});
