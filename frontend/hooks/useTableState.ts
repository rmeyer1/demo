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

    const unsubscribeTableState = on("TABLE_STATE", (...args: unknown[]) => {
      const payload = (args[0] || {}) as { state?: PublicTableView } | PublicTableView;
      const nextState = (payload as { state?: PublicTableView }).state ?? (payload as PublicTableView);
      if (!nextState) return;

      setTableState(() => {
        // Clear stale hand results when a new hand arrives
        if (handResult && handResult.handId !== nextState.handId) {
          setHandResult(null);
        }
        return nextState;
      });
    });

    const unsubscribeHandResult = on("HAND_RESULT", (...args: unknown[]) => {
      const payload = (args[0] || {}) as {
        handId?: string;
        results?: HandResultEvent["winners"];
        finalStacks?: HandResultEvent["finalStacks"];
      };
      if (!payload.handId || !payload.results || !payload.finalStacks) return;

      setHandResult({
        handId: payload.handId,
        winners: payload.results,
        finalStacks: payload.finalStacks,
      });

      // Update chip stacks eagerly so UI reflects results before next snapshot
      setTableState((prev) => {
        if (!prev) return prev;
        const updatedSeats = prev.seats.map((seat) => {
          const finalStack = payload.finalStacks!.find((fs) => fs.seatIndex === seat.seatIndex);
          return finalStack ? { ...seat, stack: finalStack.stack } : seat;
        });
        return { ...prev, seats: updatedSeats };
      });
    });

    const unsubscribeHoleCards = on("HOLE_CARDS", (...args: unknown[]) => {
      const payload = (args[0] || {}) as { handId?: string; cards?: string[] };
      if (!payload.handId || !payload.cards) return;

      setTableState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          handId: payload.handId!,
          holeCards: payload.cards,
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
