// Shared frontend-side types

export interface User {
  id: string;
  email?: string;
  displayName?: string;
}

export interface Table {
  id: string;
  hostUserId: string;
  name: string;
  status: "OPEN" | "IN_GAME" | "CLOSED";
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  inviteCode: string;
  createdAt: string;
  seats?: {
    seatIndex: number;
    userId: string | null;
    displayName: string | null;
    stack: number;
    isSittingOut: boolean;
  }[];
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
