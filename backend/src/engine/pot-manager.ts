// Pot and side pot management

import { SidePot, PlayerHandState } from "./types";
import { compareHands } from "./hand-evaluator";

export interface PotDistribution {
  mainPot: number;
  sidePots: SidePot[];
  totalPot: number;
}

export function calculatePots(playerStates: PlayerHandState[]): PotDistribution {
  // Get all unique bet amounts
  const betAmounts = new Set<number>();
  for (const player of playerStates) {
    if (player.status !== "FOLDED") {
      betAmounts.add(player.totalBet);
    }
  }

  const sortedBets = Array.from(betAmounts).sort((a, b) => a - b);
  const sidePots: SidePot[] = [];
  let mainPot = 0;

  // Create pots from smallest to largest
  for (let i = 0; i < sortedBets.length; i++) {
    const currentBet = sortedBets[i];
    const previousBet = i > 0 ? sortedBets[i - 1] : 0;
    const potAmount = (currentBet - previousBet) * getEligibleCount(playerStates, currentBet);

    const eligibleSeats = playerStates
      .filter((p) => p.status !== "FOLDED" && p.totalBet >= currentBet)
      .map((p) => p.seatIndex);

    if (i === 0) {
      mainPot = potAmount;
    } else {
      sidePots.push({
        amount: potAmount,
        eligibleSeatIndices: eligibleSeats,
      });
    }
  }

  const totalPot = mainPot + sidePots.reduce((sum, pot) => sum + pot.amount, 0);

  return {
    mainPot,
    sidePots,
    totalPot,
  };
}

function getEligibleCount(playerStates: PlayerHandState[], betAmount: number): number {
  return playerStates.filter((p) => p.status !== "FOLDED" && p.totalBet >= betAmount).length;
}

export function distributePots(
  mainPot: number,
  sidePots: SidePot[],
  playerStates: PlayerHandState[],
  evaluatedHands: Map<number, { hand: any; seatIndex: number }>
): Map<number, number> {
  const winnings = new Map<number, number>();

  // Distribute main pot
  const mainPotWinners = findWinnersForPot(
    playerStates.filter((p) => p.status !== "FOLDED" && p.totalBet > 0),
    evaluatedHands
  );
  const mainPotPerWinner = Math.floor(mainPot / mainPotWinners.length);
  const mainPotRemainder = mainPot % mainPotWinners.length;

  for (let i = 0; i < mainPotWinners.length; i++) {
    const seatIndex = mainPotWinners[i].seatIndex;
    const amount = mainPotPerWinner + (i < mainPotRemainder ? 1 : 0);
    winnings.set(seatIndex, (winnings.get(seatIndex) || 0) + amount);
  }

  // Distribute side pots
  for (const sidePot of sidePots) {
    const eligiblePlayers = playerStates.filter(
      (p) => sidePot.eligibleSeatIndices.includes(p.seatIndex) && p.status !== "FOLDED"
    );

    if (eligiblePlayers.length === 0) continue;

    const sidePotWinners = findWinnersForPot(eligiblePlayers, evaluatedHands);
    const sidePotPerWinner = Math.floor(sidePot.amount / sidePotWinners.length);
    const sidePotRemainder = sidePot.amount % sidePotWinners.length;

    for (let i = 0; i < sidePotWinners.length; i++) {
      const seatIndex = sidePotWinners[i].seatIndex;
      const amount = sidePotPerWinner + (i < sidePotRemainder ? 1 : 0);
      winnings.set(seatIndex, (winnings.get(seatIndex) || 0) + amount);
    }
  }

  return winnings;
}

function findWinnersForPot(
  eligiblePlayers: PlayerHandState[],
  evaluatedHands: Map<number, { hand: any; seatIndex: number }>
): { seatIndex: number; hand: any }[] {
  if (eligiblePlayers.length === 0) return [];

  const hands = eligiblePlayers
    .map((p) => {
      const evaluated = evaluatedHands.get(p.seatIndex);
      return evaluated ? { seatIndex: p.seatIndex, hand: evaluated.hand } : null;
    })
    .filter((h): h is { seatIndex: number; hand: any } => h !== null);

  if (hands.length === 0) return [];

  // Find best hand
  let bestHand = hands[0];
  for (const hand of hands) {
    if (compareHands(hand.hand, bestHand.hand) > 0) {
      bestHand = hand;
    }
  }

  // Find all hands that tie with the best
  const winners = hands.filter((h) => compareHands(h.hand, bestHand.hand) === 0);

  return winners;
}

