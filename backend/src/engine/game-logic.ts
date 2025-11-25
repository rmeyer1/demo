import {
  TableState,
  HandState,
  EngineResult,
  PlayerAction,
  EngineEvent,
  PlayerHandState,
  BettingRoundState,
} from "./types";
import { createDeck, shuffleDeck, dealCard, cardToString } from "./cards";
import { evaluateHand, EvaluatedHand } from "./hand-evaluator";
import { calculatePots, distributePots } from "./pot-manager";

export function startHandImpl(state: TableState): EngineResult {
  if (state.currentHand) {
    throw new Error("HAND_ALREADY_ACTIVE");
  }

  const activeSeats = state.seats.filter(
    (s) => s.userId && !s.isSittingOut && s.stack > 0
  );

  if (activeSeats.length < 2) {
    throw new Error("NOT_ENOUGH_PLAYERS");
  }

  // Move dealer button
  const newDealerSeatIndex = getNextDealerSeat(state);
  const smallBlindSeatIndex = getNextActiveSeat(state, newDealerSeatIndex);
  const bigBlindSeatIndex = getNextActiveSeat(state, smallBlindSeatIndex);

  // Create and shuffle deck
  let deck = shuffleDeck(createDeck());

  // Post blinds
  const playerStates: PlayerHandState[] = [];
  const events: EngineEvent[] = [];

  for (const seat of activeSeats) {
    const seatIndex = seat.seatIndex;
    let currentBet = 0;
    let totalBet = 0;

    // Post small blind
    if (seatIndex === smallBlindSeatIndex) {
      const blindAmount = Math.min(state.smallBlind, seat.stack);
      currentBet = blindAmount;
      totalBet = blindAmount;
      state.seats[seatIndex].stack -= blindAmount;
      if (state.seats[seatIndex].stack === 0) {
        // All-in on blind
      }
    }

    // Post big blind
    if (seatIndex === bigBlindSeatIndex) {
      const blindAmount = Math.min(state.bigBlind, seat.stack);
      if (currentBet === 0) {
        currentBet = blindAmount;
        totalBet = blindAmount;
      } else {
        // This shouldn't happen, but handle it
        totalBet = blindAmount;
      }
      state.seats[seatIndex].stack -= blindAmount;
      if (state.seats[seatIndex].stack === 0) {
        // All-in on blind
      }
    }

    playerStates.push({
      seatIndex,
      userId: seat.userId!,
      holeCards: null, // Will be dealt next
      currentBet,
      totalBet,
      status: seat.stack === 0 ? "ALL_IN" : "ACTIVE",
      isAllIn: seat.stack === 0,
      hasActed: false,
    });
  }

  // Deal hole cards (two passes)
  for (let pass = 0; pass < 2; pass++) {
    for (const playerState of playerStates) {
      const { card, remainingDeck } = dealCard(deck);
      deck = remainingDeck;
      if (!playerState.holeCards) {
        playerState.holeCards = [card, null as any];
      } else {
        playerState.holeCards[1] = card;
      }
    }
  }

  // Emit hole cards events (will be sent to individual players)
  for (const playerState of playerStates) {
    events.push({
      type: "HOLE_CARDS",
      userId: playerState.userId,
      seatIndex: playerState.seatIndex,
      cards: playerState.holeCards!.map(cardToString),
    });
  }

  // Determine action order (heads-up special case)
  const isHeadsUp = activeSeats.length === 2;
  let firstToAct: number;
  if (isHeadsUp) {
    // Dealer acts first preflop in heads-up
    firstToAct = newDealerSeatIndex;
  } else {
    // First active player after big blind
    firstToAct = getNextActiveSeat(state, bigBlindSeatIndex);
  }

  // Initialize betting round
  const currentBet = state.bigBlind;
  const minRaise = state.bigBlind;
  const contributions: Record<number, number> = {};
  for (const ps of playerStates) {
    contributions[ps.seatIndex] = ps.totalBet;
  }

  const betting: BettingRoundState = {
    street: "PREFLOP",
    currentBet,
    minRaise,
    lastAggressorSeatIndex: bigBlindSeatIndex,
    toActSeatIndex: firstToAct,
    contributions,
  };

  const handId = `hand-${Date.now()}-${state.handNumber}`;
  const handState: HandState = {
    handId,
    handNumber: state.handNumber,
    dealerSeatIndex: newDealerSeatIndex,
    smallBlindSeatIndex,
    bigBlindSeatIndex,
    communityCards: [],
    street: "PREFLOP",
    potTotal: playerStates.reduce((sum, p) => sum + p.totalBet, 0),
    mainPot: 0,
    sidePots: [],
    toActSeatIndex: firstToAct,
    minBet: state.bigBlind,
    callAmount:
      currentBet -
      (playerStates.find((p) => p.seatIndex === firstToAct)?.currentBet || 0),
    playerStates,
    deck,
    burnedCards: [],
    betting,
  };

  // Calculate initial pots
  const potDistribution = calculatePots(playerStates);
  handState.mainPot = potDistribution.mainPot;
  handState.sidePots = potDistribution.sidePots;
  handState.potTotal = potDistribution.totalPot;

  events.push({
    type: "HAND_STARTED",
    handId,
    dealerSeatIndex: newDealerSeatIndex,
    smallBlindSeatIndex,
    bigBlindSeatIndex,
  });

  const newState: TableState = {
    ...state,
    currentHand: handState,
    dealerSeatIndex: newDealerSeatIndex,
    lastDealerSeatIndex: newDealerSeatIndex,
    handNumber: state.handNumber + 1,
  };

  return {
    state: newState,
    events,
  };
}

export function applyPlayerAction(
  state: TableState,
  seatIndex: number,
  action: PlayerAction
): EngineResult {
  if (!state.currentHand) {
    throw new Error("NO_ACTIVE_HAND");
  }

  const hand = state.currentHand;
  const playerState = hand.playerStates.find((p) => p.seatIndex === seatIndex);

  if (!playerState) {
    throw new Error("PLAYER_NOT_IN_HAND");
  }

  if (playerState.status !== "ACTIVE") {
    throw new Error("PLAYER_CANNOT_ACT");
  }

  if (hand.toActSeatIndex !== seatIndex) {
    throw new Error("NOT_YOUR_TURN");
  }

  const seat = state.seats[seatIndex];
  const events: EngineEvent[] = [];
  playerState.hasActed = true;

  // Validate and apply action
  switch (action.action) {
    case "FOLD":
      playerState.status = "FOLDED";
      break;

    case "CHECK":
      if (hand.callAmount > 0) {
        throw new Error("CANNOT_CHECK_FACING_BET");
      }
      break;

    case "CALL":
      if (hand.callAmount === 0) {
        throw new Error("CANNOT_CALL_ZERO");
      }
      const callAmount = Math.min(hand.callAmount, seat.stack);
      playerState.currentBet += callAmount;
      playerState.totalBet += callAmount;
      seat.stack -= callAmount;

      if (seat.stack === 0) {
        playerState.isAllIn = true;
        playerState.status = "ALL_IN";
      }
      break;

    case "BET":
      if (hand.callAmount > 0) {
        throw new Error("CANNOT_BET_FACING_BET");
      }
      if (!action.amount || action.amount < hand.minBet) {
        throw new Error("BET_TOO_SMALL");
      }
      const betAmount = Math.min(action.amount, seat.stack);
      playerState.currentBet += betAmount;
      playerState.totalBet += betAmount;
      seat.stack -= betAmount;
      hand.betting.currentBet = playerState.currentBet;
      hand.betting.lastAggressorSeatIndex = seatIndex;
      hand.betting.minRaise = betAmount;

      if (seat.stack === 0) {
        playerState.isAllIn = true;
        playerState.status = "ALL_IN";
      }
      break;

    case "RAISE":
      if (hand.callAmount === 0) {
        throw new Error("CANNOT_RAISE_WITHOUT_BET");
      }
      if (!action.amount) {
        throw new Error("RAISE_AMOUNT_REQUIRED");
      }
      const totalRaiseAmount = hand.callAmount + action.amount;
      if (totalRaiseAmount < hand.betting.minRaise) {
        throw new Error("RAISE_TOO_SMALL");
      }
      const raiseAmount = Math.min(totalRaiseAmount, seat.stack);
      const actualCall = Math.min(hand.callAmount, seat.stack);
      const actualRaise = raiseAmount - actualCall;

      playerState.currentBet += raiseAmount;
      playerState.totalBet += raiseAmount;
      seat.stack -= raiseAmount;
      hand.betting.currentBet = playerState.currentBet;
      hand.betting.lastAggressorSeatIndex = seatIndex;
      hand.betting.minRaise = actualRaise;

      if (seat.stack === 0) {
        playerState.isAllIn = true;
        playerState.status = "ALL_IN";
      }
      break;

    case "ALL_IN":
      const allInAmount = seat.stack;
      if (allInAmount === 0) {
        throw new Error("ALREADY_ALL_IN");
      }

      const neededToCall = hand.callAmount - playerState.currentBet;
      if (neededToCall > 0 && allInAmount <= neededToCall) {
        // All-in is just a call
        playerState.currentBet += allInAmount;
        playerState.totalBet += allInAmount;
      } else {
        // All-in is a raise
        const raiseSize = allInAmount - neededToCall;
        playerState.currentBet += allInAmount;
        playerState.totalBet += allInAmount;
        if (raiseSize >= hand.betting.minRaise) {
          hand.betting.currentBet = playerState.currentBet;
          hand.betting.lastAggressorSeatIndex = seatIndex;
          hand.betting.minRaise = raiseSize;
        }
      }

      seat.stack = 0;
      playerState.isAllIn = true;
      playerState.status = "ALL_IN";
      break;
  }

  // Update contributions
  hand.betting.contributions[seatIndex] = playerState.totalBet;

  // Recalculate pots
  const potDistribution = calculatePots(hand.playerStates);
  hand.mainPot = potDistribution.mainPot;
  hand.sidePots = potDistribution.sidePots;
  hand.potTotal = potDistribution.totalPot;

  // Move to next player
  const nextPlayer = getNextToAct(state, seatIndex);
  hand.toActSeatIndex = nextPlayer;
  hand.betting.toActSeatIndex = nextPlayer;

  // Update call amount for next player
  if (nextPlayer !== undefined) {
    const nextPlayerState = hand.playerStates.find(
      (p) => p.seatIndex === nextPlayer
    );
    if (nextPlayerState) {
      hand.callAmount = hand.betting.currentBet - nextPlayerState.currentBet;
    }
  }

  events.push({
    type: "PLAYER_ACTION_APPLIED",
    seatIndex,
    action: action.action,
    amount: action.amount || 0,
    betting: {
      street: hand.betting.street,
      currentBet: hand.betting.currentBet,
      minRaise: hand.betting.minRaise,
      toActSeatIndex: hand.betting.toActSeatIndex,
    },
    potTotal: hand.potTotal,
  });

  return {
    state,
    events,
    seatIndex,
    betting: hand.betting,
    potTotal: hand.potTotal,
  };
}

export function advanceIfReady(state: TableState): EngineResult | null {
  if (!state.currentHand) {
    return null;
  }

  const hand = state.currentHand;

  // Check if betting round is complete
  if (!isBettingRoundComplete(state)) {
    return null;
  }

  const events: EngineEvent[] = [];
  let newState = { ...state };

  // Check if only one player remains (excluding folded players; ALL_IN still contest the pot)
  const livePlayers = hand.playerStates.filter((p) => p.status !== "FOLDED");
  if (livePlayers.length <= 1) {
    // Hand ends, one winner
    const winner = livePlayers[0];
    if (winner) {
      // Distribute pot to winner
      const winnings = hand.potTotal;
      newState.seats[winner.seatIndex].stack += winnings;

      events.push({
        type: "HAND_RESULT",
        winners: [
          {
            seatIndex: winner.seatIndex,
            handRank: "N/A",
            handDescription: "Won by default",
            wonAmount: winnings,
          },
        ],
        finalStacks: newState.seats.map((s) => ({
          seatIndex: s.seatIndex,
          stack: s.stack,
        })),
      });
    }

    newState.currentHand = undefined;
    return {
      state: newState,
      events: [
        ...events,
        {
          type: "HAND_COMPLETE",
        },
      ],
    };
  }

  // Advance to next street
  switch (hand.street) {
    case "PREFLOP":
      // Deal flop
      const { card: burn1, remainingDeck: deck1 } = dealCard(hand.deck);
      hand.burnedCards.push(burn1);
      const { card: flop1, remainingDeck: deck2 } = dealCard(deck1);
      const { card: flop2, remainingDeck: deck3 } = dealCard(deck2);
      const { card: flop3, remainingDeck: deck4 } = dealCard(deck3);
      hand.communityCards = [flop1, flop2, flop3];
      hand.deck = deck4;
      hand.street = "FLOP";
      hand.betting.street = "FLOP";
      resetBettingRound(hand, state);
      events.push({
        type: "CARDS_DEALT",
        street: "FLOP",
        communityCards: hand.communityCards.map(cardToString),
      });
      break;

    case "FLOP":
      // Deal turn
      const { card: burn2, remainingDeck: deck5 } = dealCard(hand.deck);
      hand.burnedCards.push(burn2);
      const { card: turn, remainingDeck: deck6 } = dealCard(deck5);
      hand.communityCards.push(turn);
      hand.deck = deck6;
      hand.street = "TURN";
      hand.betting.street = "TURN";
      resetBettingRound(hand, state);
      events.push({
        type: "CARDS_DEALT",
        street: "TURN",
        communityCards: hand.communityCards.map(cardToString),
      });
      break;

    case "TURN":
      // Deal river
      const { card: burn3, remainingDeck: deck7 } = dealCard(hand.deck);
      hand.burnedCards.push(burn3);
      const { card: river, remainingDeck: deck8 } = dealCard(deck7);
      hand.communityCards.push(river);
      hand.deck = deck8;
      hand.street = "RIVER";
      hand.betting.street = "RIVER";
      resetBettingRound(hand, state);
      events.push({
        type: "CARDS_DEALT",
        street: "RIVER",
        communityCards: hand.communityCards.map(cardToString),
      });
      break;

    case "RIVER":
      // Showdown
      return performShowdown(state, events);
  }

  return {
    state: newState,
    events,
  };
}

function performShowdown(
  state: TableState,
  events: EngineEvent[]
): EngineResult {
  const hand = state.currentHand!;
  const activePlayers = hand.playerStates.filter((p) => p.status !== "FOLDED");

  // Evaluate all hands
  const evaluatedHands = new Map<
    number,
    { hand: EvaluatedHand; seatIndex: number }
  >();
  for (const player of activePlayers) {
    if (player.holeCards) {
      const allCards = [...player.holeCards, ...hand.communityCards];
      const evaluated = evaluateHand(allCards);
      evaluatedHands.set(player.seatIndex, {
        hand: evaluated,
        seatIndex: player.seatIndex,
      });
    }
  }

  // Distribute pots
  const winnings = distributePots(
    hand.mainPot,
    hand.sidePots,
    hand.playerStates,
    evaluatedHands
  );

  // Update stacks
  const finalStacks: { seatIndex: number; stack: number }[] = [];
  for (const [seatIndex, amount] of winnings.entries()) {
    state.seats[seatIndex].stack += amount;
    finalStacks.push({ seatIndex, stack: state.seats[seatIndex].stack });
  }

  // Build winners list
  const winners = Array.from(winnings.entries()).map(
    ([seatIndex, wonAmount]) => {
      const evaluated = evaluatedHands.get(seatIndex);
      return {
        seatIndex,
        handRank: evaluated?.hand.category || "UNKNOWN",
        handDescription: evaluated?.hand.description || "Unknown",
        wonAmount,
      };
    }
  );

  events.push({
    type: "HAND_RESULT",
    winners,
    finalStacks,
  });

  const newState: TableState = {
    ...state,
    currentHand: undefined,
  };

  return {
    state: newState,
    events: [
      ...events,
      {
        type: "HAND_COMPLETE",
      },
    ],
  };
}

function resetBettingRound(hand: HandState, state: TableState): void {
  // Reset betting state for new street
  hand.betting.currentBet = 0;
  hand.betting.minRaise = state.bigBlind;
  hand.betting.lastAggressorSeatIndex = undefined;
  hand.betting.contributions = {};

  // Reset current bets for all active players
  for (const playerState of hand.playerStates) {
    if (playerState.status === "ACTIVE") {
      playerState.currentBet = 0;
      hand.betting.contributions[playerState.seatIndex] = playerState.totalBet;
      playerState.hasActed = false;
    }
  }

  // Set first to act (dealer in postflop, or first active after dealer)
  const firstToAct = getNextActiveSeat(state, hand.dealerSeatIndex);
  hand.toActSeatIndex = firstToAct;
  hand.betting.toActSeatIndex = firstToAct;
  hand.callAmount = 0;
}

function isBettingRoundComplete(state: TableState): boolean {
  const hand = state.currentHand!;
  const activePlayers = hand.playerStates.filter(
    (p) => p.status === "ACTIVE" && !p.isAllIn
  );

  if (activePlayers.length === 0) return true;

  const currentBet = hand.betting.currentBet;
  const allMatchedBet = activePlayers.every((p) => p.currentBet === currentBet);
  const allHaveActed = activePlayers.every((p) => p.hasActed);

  return allMatchedBet && allHaveActed;
}

function getNextActiveSeat(state: TableState, startSeatIndex: number): number {
  const activeSeats = state.seats
    .map((s, i) => ({ seat: s, index: i }))
    .filter(({ seat }) => seat.userId && !seat.isSittingOut && seat.stack > 0);

  if (activeSeats.length === 0) {
    throw new Error("NO_ACTIVE_SEATS");
  }

  const startIndex = activeSeats.findIndex(
    ({ index }) => index === startSeatIndex
  );
  if (startIndex === -1) {
    return activeSeats[0].index;
  }

  const nextIndex = (startIndex + 1) % activeSeats.length;
  return activeSeats[nextIndex].index;
}

function getNextToAct(
  state: TableState,
  currentSeatIndex: number
): number | undefined {
  const hand = state.currentHand!;
  const activePlayers = hand.playerStates.filter(
    (p) => p.status === "ACTIVE" && !p.isAllIn
  );

  if (activePlayers.length <= 1) {
    return undefined;
  }

  const currentIndex = activePlayers.findIndex(
    (p) => p.seatIndex === currentSeatIndex
  );
  if (currentIndex === -1) {
    return activePlayers[0]?.seatIndex;
  }

  const nextIndex = (currentIndex + 1) % activePlayers.length;
  return activePlayers[nextIndex]?.seatIndex;
}

function getNextDealerSeat(state: TableState): number {
  const activeSeats = state.seats
    .map((s, i) => ({ seat: s, index: i }))
    .filter(({ seat }) => seat.userId && !seat.isSittingOut && seat.stack > 0);

  if (activeSeats.length === 0) {
    throw new Error("NO_ACTIVE_SEATS");
  }

  if (state.lastDealerSeatIndex === null) {
    return activeSeats[0].index;
  }

  const startIndex = activeSeats.findIndex(
    ({ index }) => index === state.lastDealerSeatIndex
  );
  if (startIndex === -1) {
    return activeSeats[0].index;
  }

  const nextIndex = (startIndex + 1) % activeSeats.length;
  return activeSeats[nextIndex].index;
}
