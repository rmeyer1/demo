// WebSocket message types

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface JoinTableMessage extends WSMessage {
  type: "JOIN_TABLE";
  tableId: string;
}

export interface LeaveTableMessage extends WSMessage {
  type: "LEAVE_TABLE";
  tableId: string;
}

export interface SitDownMessage extends WSMessage {
  type: "SIT_DOWN";
  tableId: string;
  seatIndex: number;
  buyInAmount: number;
}

export interface StandUpMessage extends WSMessage {
  type: "STAND_UP";
  tableId: string;
}

export interface PlayerActionMessage extends WSMessage {
  type: "PLAYER_ACTION";
  tableId: string;
  handId: string;
  action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
  amount?: number;
}

export interface ChatSendMessage extends WSMessage {
  type: "CHAT_SEND";
  tableId: string;
  content: string;
}

export interface PingMessage extends WSMessage {
  type: "PING";
}

export interface PongMessage extends WSMessage {
  type: "PONG";
  timestamp: string;
}

export interface ErrorMessage extends WSMessage {
  type: "ERROR";
  code: string;
  message: string;
}
