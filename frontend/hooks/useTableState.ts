"use client";

import { useState, useEffect, useCallback } from "react";
import type { HandResultEvent, PublicTableView } from "@/lib/types";
import { useWebSocket } from "./useWebSocket";

export function useTableState(tableId: string) {
  const [tableState, setTableState] = useState<PublicTableView | null>(null);
  const [handResult, setHandResult] = useState<HandResultEvent | null>(null);
  const { socket, connected, on, emit } = useWebSocket(tableId);

  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribeTableState = on("TABLE_STATE", (payload: unknown) => {
      const parsed = payload as { state?: PublicTableView; tableId?: string } | PublicTableView;
      const nextState = (parsed as { state?: PublicTableView }).state ?? (parsed as PublicTableView);
      if (nextState) {
        setTableState(() => {
          // Clear stale hand results when a new hand arrives
          if (handResult && handResult.handId !== nextState.handId) {
            setHandResult(null);
          }
          return nextState;
        });
      }
    });

    const unsubscribeHandResult = on("HAND_RESULT", (payload: unknown) => {
      const parsed = payload as {
        handId?: string;
        results?: HandResultEvent["winners"];
        finalStacks?: HandResultEvent["finalStacks"];
      };
      if (!parsed.handId || !parsed.results || !parsed.finalStacks) return;

      setHandResult({
        handId: parsed.handId,
        winners: parsed.results,
        finalStacks: parsed.finalStacks,
      });

      // Update chip stacks eagerly so UI reflects results before next snapshot
      setTableState((prev) => {
        if (!prev) return prev;
        const updatedSeats = prev.seats.map((seat) => {
          const finalStack = parsed.finalStacks!.find((fs) => fs.seatIndex === seat.seatIndex);
          return finalStack ? { ...seat, stack: finalStack.stack } : seat;
        });
        return { ...prev, seats: updatedSeats };
      });
    });

    const unsubscribeHoleCards = on("HOLE_CARDS", (payload: unknown) => {
      const parsed = payload as { tableId?: string; handId?: string; cards?: string[] };
      if (!parsed.handId || !parsed.cards) return;
      setTableState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          handId: parsed.handId,
          holeCards: parsed.cards,
        };
      });
    });

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
