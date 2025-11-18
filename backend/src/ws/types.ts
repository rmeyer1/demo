export interface PlayerActionMessage {
  tableId: string;
  handId: string;
  action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
  amount?: number;
}

export interface ChatSendMessage {
  tableId: string;
  content: string;
}

export interface PongMessage {
  timestamp: string;
}

export interface ErrorMessage {
  code: string;
  message: string;
}
