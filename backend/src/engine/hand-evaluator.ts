// Poker hand evaluation

import { Card, Rank } from "./cards";

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
  scoreVector: number[];
  description: string;
}

const RANK_VALUES: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const CATEGORY_VALUES: Record<HandRankCategory, number> = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards to evaluate hand");
  }

  // Get all possible 5-card combinations
  const combinations = getCombinations(cards, 5);
  let bestHand: EvaluatedHand | null = null;

  for (const combo of combinations) {
    const evaluated = evaluateFiveCards(combo);
    if (!bestHand || compareHands(evaluated, bestHand) > 0) {
      bestHand = evaluated;
    }
  }

  return bestHand!;
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  if (k === arr.length) return [arr];

  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
    for (const combo of tailCombos) {
      result.push([head, ...combo]);
    }
  }
  return result;
}

function evaluateFiveCards(cards: Card[]): EvaluatedHand {
  const ranks = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const rankCounts = getRankCounts(ranks);
  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = isStraightCheck(ranks);
  const isRoyal = isRoyalStraight(ranks);

  // Royal Flush
  if (isRoyal && isFlush) {
    return {
      category: "ROYAL_FLUSH",
      scoreVector: [CATEGORY_VALUES.ROYAL_FLUSH],
      description: "Royal Flush",
    };
  }

  // Straight Flush
  if (isStraight && isFlush) {
    return {
      category: "STRAIGHT_FLUSH",
      scoreVector: [CATEGORY_VALUES.STRAIGHT_FLUSH, ranks[0]],
      description: `Straight Flush, ${getRankName(ranks[0])} high`,
    };
  }

  // Four of a Kind
  const fourOfKind = findCount(rankCounts, 4);
  if (fourOfKind) {
    const kicker = ranks.find((r) => r !== fourOfKind)!;
    return {
      category: "FOUR_OF_A_KIND",
      scoreVector: [CATEGORY_VALUES.FOUR_OF_A_KIND, fourOfKind, kicker],
      description: `Four of a Kind, ${getRankName(fourOfKind)}s`,
    };
  }

  // Full House
  const threeOfKind = findCount(rankCounts, 3);
  const pair = findCount(rankCounts, 2);
  if (threeOfKind && pair) {
    return {
      category: "FULL_HOUSE",
      scoreVector: [CATEGORY_VALUES.FULL_HOUSE, threeOfKind, pair],
      description: `Full House, ${getRankName(threeOfKind)}s full of ${getRankName(pair)}s`,
    };
  }

  // Flush
  if (isFlush) {
    return {
      category: "FLUSH",
      scoreVector: [CATEGORY_VALUES.FLUSH, ...ranks],
      description: `Flush, ${getRankName(ranks[0])} high`,
    };
  }

  // Straight
  if (isStraight) {
    return {
      category: "STRAIGHT",
      scoreVector: [CATEGORY_VALUES.STRAIGHT, ranks[0]],
      description: `Straight, ${getRankName(ranks[0])} high`,
    };
  }

  // Three of a Kind
  if (threeOfKind) {
    const kickers = ranks.filter((r) => r !== threeOfKind).sort((a, b) => b - a);
    return {
      category: "THREE_OF_A_KIND",
      scoreVector: [CATEGORY_VALUES.THREE_OF_A_KIND, threeOfKind, ...kickers],
      description: `Three of a Kind, ${getRankName(threeOfKind)}s`,
    };
  }

  // Two Pair
  const pairs = findAllCounts(rankCounts, 2);
  if (pairs.length >= 2) {
    const sortedPairs = pairs.sort((a, b) => b - a);
    const kicker = ranks.find((r) => !pairs.includes(r))!;
    return {
      category: "TWO_PAIR",
      scoreVector: [CATEGORY_VALUES.TWO_PAIR, sortedPairs[0], sortedPairs[1], kicker],
      description: `Two Pair, ${getRankName(sortedPairs[0])}s and ${getRankName(sortedPairs[1])}s`,
    };
  }

  // One Pair
  if (pair) {
    const kickers = ranks.filter((r) => r !== pair).sort((a, b) => b - a);
    return {
      category: "ONE_PAIR",
      scoreVector: [CATEGORY_VALUES.ONE_PAIR, pair, ...kickers],
      description: `One Pair, ${getRankName(pair)}s`,
    };
  }

  // High Card
  return {
    category: "HIGH_CARD",
    scoreVector: [CATEGORY_VALUES.HIGH_CARD, ...ranks],
    description: `${getRankName(ranks[0])} high`,
  };
}

function getRankCounts(ranks: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) || 0) + 1);
  }
  return counts;
}

function findCount(rankCounts: Map<number, number>, count: number): number | null {
  for (const [rank, cnt] of rankCounts.entries()) {
    if (cnt === count) return rank;
  }
  return null;
}

function findAllCounts(rankCounts: Map<number, number>, count: number): number[] {
  const result: number[] = [];
  for (const [rank, cnt] of rankCounts.entries()) {
    if (cnt === count) result.push(rank);
  }
  return result;
}

function isStraightCheck(ranks: number[]): boolean {
  const sorted = [...new Set(ranks)].sort((a, b) => a - b);
  if (sorted.length !== 5) return false;

  // Check for regular straight
  if (sorted[4] - sorted[0] === 4) return true;

  // Check for A-2-3-4-5 straight (wheel)
  if (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5 && sorted[4] === 14) {
    return true;
  }

  return false;
}

function isRoyalStraight(ranks: number[]): boolean {
  const sorted = [...new Set(ranks)].sort((a, b) => a - b);
  return sorted[0] === 10 && sorted[1] === 11 && sorted[2] === 12 && sorted[3] === 13 && sorted[4] === 14;
}

function getRankName(rankValue: number): string {
  const entries = Object.entries(RANK_VALUES);
  const entry = entries.find(([, v]) => v === rankValue);
  return entry ? entry[0] : String(rankValue);
}

export function compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
  const v1 = hand1.scoreVector;
  const v2 = hand2.scoreVector;

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const val1 = v1[i] || 0;
    const val2 = v2[i] || 0;
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  return 0;
}

