// Game engine types

import { Card } from "./cards";
import { EvaluatedHand } from "./hand-evaluator";

export interface TableState {
  tableId: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  seats: SeatState[];
  currentHand?: HandState;
  dealerSeatIndex: number;
  lastDealerSeatIndex: number | null;
  handNumber: number;
}

export interface SeatState {
  seatIndex: number;
  userId: string | null;
  displayName: string;
  stack: number;
  isSittingOut: boolean;
}

export type Street = "DEALING" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN" | "COMPLETE";

export interface BettingRoundState {
  street: Street;
  currentBet: number;
  minRaise: number;
  lastAggressorSeatIndex?: number;
  toActSeatIndex?: number;
  contributions: Record<number, number>;
}

export interface HandState {
  handId: string;
  handNumber: number;
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  communityCards: Card[];
  street: Street;
  potTotal: number;
  mainPot: number;
  sidePots: SidePot[];
  toActSeatIndex?: number;
  minBet: number;
  callAmount: number;
  playerStates: PlayerHandState[];
  deck: Card[];
  burnedCards: Card[];
  betting: BettingRoundState;
  showdownResults?: ShowdownResult;
}

export interface PlayerHandState {
  seatIndex: number;
  userId: string;
  holeCards: [Card, Card] | null;
  currentBet: number;
  totalBet: number;
  status: "ACTIVE" | "FOLDED" | "ALL_IN";
  isAllIn: boolean;
  hasActed: boolean;
}

export interface SidePot {
  amount: number;
  eligibleSeatIndices: number[];
}

export interface ShowdownResult {
  winners: {
    seatIndex: number;
    hand: EvaluatedHand;
    wonAmount: number;
  }[];
  finalStacks: {
    seatIndex: number;
    stack: number;
  }[];
}

export interface EngineEvent {
  type: string;
  [key: string]: any;
}

export interface EngineResult {
  state: TableState;
  events: EngineEvent[];
  seatIndex?: number;
  betting?: any;
  potTotal?: number;
}

export interface PlayerAction {
  action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
  amount?: number;
}

export interface User {
  id: string;
  displayName: string;
}
