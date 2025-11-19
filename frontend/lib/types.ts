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
  seats?: TableSeat[];
}

export type SeatStatus = "ACTIVE" | "FOLDED" | "ALL_IN" | "SITTING_OUT";

export type Street =
  | "WAITING"
  | "DEALING"
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "COMPLETE";

export interface TableSeat {
  seatIndex: number;
  userId: string | null;
  displayName: string | null;
  stack: number;
  isSittingOut: boolean;
}

export interface PublicSeatView {
  seatIndex: number;
  displayName: string;
  stack: number;
  status: SeatStatus;
  isSelf: boolean;
}

export interface PublicTableView {
  tableId: string;
  seats: PublicSeatView[];
  communityCards: string[];
  potTotal: number;
  street: Street | null;
  toActSeatIndex?: number;
  minBet?: number;
  callAmount?: number;
  handId?: string;
  holeCards?: string[];
}

export interface HandResultEvent {
  handId: string;
  winners: Array<{
    seatIndex: number;
    handRank: string;
    handDescription: string;
    wonAmount: number;
  }>;
  finalStacks: Array<{
    seatIndex: number;
    stack: number;
  }>;
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
