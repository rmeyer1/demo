// Common types used across the backend

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface TableState {
  tableId: string;
  seats: SeatState[];
  communityCards: string[];
  potTotal: number;
  street: string;
  toActSeatIndex?: number;
  minBet?: number;
  callAmount?: number;
  handId?: string;
  holeCards?: string[]; // Only for the requesting user
}

export interface SeatState {
  seatIndex: number;
  displayName: string;
  stack: number;
  status: string;
  isSelf: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  seatIndex: number | null;
  content: string;
  createdAt: string;
}

export interface HandResult {
  winners: {
    seatIndex: number;
    handRank: string;
    handDescription: string;
    wonAmount: number;
  }[];
  finalStacks: {
    seatIndex: number;
    stack: number;
  }[];
}

