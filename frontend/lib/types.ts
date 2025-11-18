// Shared frontend-side types

export interface User {
  id: string;
  email?: string;
  displayName?: string;
}

export interface Table {
  id: string;
  name: string;
  hostId: string;
  status: "OPEN" | "IN_GAME" | "CLOSED";
  playerCount: number;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface TableState {
  tableId: string;
  handNumber: number;
  currentStreet: "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
  communityCards: string[];
  pot: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  dealerPosition: number;
  activePlayerPosition?: number;
  players: PlayerState[];
}

export interface PlayerState {
  userId: string;
  position: number;
  chips: number;
  bet: number;
  isActive: boolean;
  isAllIn: boolean;
  hasActed: boolean;
  holeCards?: string[];
}

export interface ChatMessage {
  id: string;
  tableId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export interface DashboardSummary {
  totalHands: number;
  netChips: number;
  vpip: number;
  pfr: number;
  showdownWinRate: number;
  bbPer100: number;
}

export interface DashboardProgression {
  date: string;
  netChips: number;
  hands: number;
}


