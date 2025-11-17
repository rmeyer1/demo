import { TableState, HandState } from "./types";
import { cardToString } from "./cards";

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
  return {
    tableId: input.tableId,
    maxPlayers: input.maxPlayers,
    smallBlind: input.smallBlind,
    bigBlind: input.bigBlind,
    seats: input.seats.map((s) => ({
      seatIndex: s.seatIndex,
      userId: s.userId,
      displayName: s.displayName,
      stack: s.stack,
      isSittingOut: s.isSittingOut,
    })),
    dealerSeatIndex: 0,
    lastDealerSeatIndex: null,
    handNumber: 0,
  };
}

export function getPublicTableView(state: TableState, userId: string): any {
  const userSeat = state.seats.find((s) => s.userId === userId);
  const hand = state.currentHand;

  // Get player status from hand if active, otherwise from seat
  const getPlayerStatus = (seatIndex: number): string => {
    if (state.seats[seatIndex].isSittingOut) {
      return "SITTING_OUT";
    }
    if (hand) {
      const playerState = hand.playerStates.find((p) => p.seatIndex === seatIndex);
      if (playerState) {
        return playerState.status;
      }
    }
    return "ACTIVE";
  };

  return {
    tableId: state.tableId,
    seats: state.seats.map((seat) => ({
      seatIndex: seat.seatIndex,
      displayName: seat.displayName,
      stack: seat.stack,
      status: getPlayerStatus(seat.seatIndex),
      isSelf: seat.userId === userId,
    })),
    communityCards: hand?.communityCards.map(cardToString) || [],
    potTotal: hand?.potTotal || 0,
    street: hand?.street || "WAITING",
    toActSeatIndex: hand?.toActSeatIndex,
    minBet: hand?.minBet || state.bigBlind,
    callAmount: hand?.callAmount || 0,
    handId: hand?.handId,
    holeCards:
      userSeat && hand
        ? hand.playerStates
            .find((p) => p.seatIndex === userSeat.seatIndex)
            ?.holeCards?.map(cardToString) || undefined
        : undefined,
  };
}

