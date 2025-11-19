"use client";

import { useState, useEffect, useCallback } from "react";
import type { HandResultEvent, PublicTableView } from "@/lib/types";
import { useWebSocket } from "./useWebSocket";

export function useTableState(tableId: string, inviteCode?: string | null) {
  const [tableState, setTableState] = useState<PublicTableView | null>(null);
  const [handResult, setHandResult] = useState<HandResultEvent | null>(null);
  const { socket, connected, on, emit } = useWebSocket(tableId, inviteCode);

  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribeTableState = on(
      "TABLE_STATE",
      (payload: { state?: PublicTableView; tableId: string }) => {
        const nextState = payload.state ?? (payload as unknown as PublicTableView);
        setTableState(() => {
          // Clear stale hand results when a new hand arrives
          if (handResult && handResult.handId !== nextState.handId) {
            setHandResult(null);
          }
          return nextState;
        });
      }
    );

    const unsubscribeHandResult = on(
      "HAND_RESULT",
      (payload: { handId: string; results: HandResultEvent["winners"]; finalStacks: HandResultEvent["finalStacks"] }) => {
        setHandResult({
          handId: payload.handId,
          winners: payload.results,
          finalStacks: payload.finalStacks,
        });

        // Update chip stacks eagerly so UI reflects results before next snapshot
        setTableState((prev) => {
          if (!prev) return prev;
          const updatedSeats = prev.seats.map((seat) => {
            const finalStack = payload.finalStacks.find((fs) => fs.seatIndex === seat.seatIndex);
            return finalStack ? { ...seat, stack: finalStack.stack } : seat;
          });
          return { ...prev, seats: updatedSeats };
        });
      }
    );

    const unsubscribeHoleCards = on(
      "HOLE_CARDS",
      (payload: { tableId: string; handId: string; cards: string[] }) => {
        setTableState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            handId: payload.handId,
            holeCards: payload.cards,
          };
        });
      }
    );

    return () => {
      unsubscribeTableState?.();
      unsubscribeHandResult?.();
      unsubscribeHoleCards?.();
    };
  }, [socket, connected, on, handResult]);

  const startGame = useCallback(() => {
    if (connected) {
      emit("GAME_START", { tableId });
    }
  }, [connected, emit, tableId]);

  return { tableState, handResult, clearHandResult: () => setHandResult(null), connected, startGame };
}
