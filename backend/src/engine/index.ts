import {
  TableState,
  HandState,
  EngineResult,
  PlayerAction,
  EngineEvent,
} from "./types";
import { initTableState as initState } from "./state-helpers";
import { applyPlayerAction as applyAction, advanceIfReady as advanceReady, startHandImpl } from "./game-logic";
import { getPublicTableView as getView } from "./state-helpers";

export function initTableState(input: {
  tableId: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  seats: Array<{
    seatIndex: number;
    userId: string | null;
    displayName: string;
    stack: number;
    isSittingOut: boolean;
  }>;
}): TableState {
  return initState(input);
}

export function startHand(state: TableState): EngineResult {
  return startHandImpl(state);
}

export function applyPlayerAction(
  state: TableState,
  seatIndex: number,
  action: PlayerAction
): EngineResult {
  return applyAction(state, seatIndex, action);
}

export function advanceIfReady(state: TableState): EngineResult | null {
  return advanceReady(state);
}

export function getPublicTableView(
  state: TableState,
  userId: string
): any {
  return getView(state, userId);
}

