"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { HandResultEvent, PublicTableView } from "@/lib/types";
import { useWebSocket } from "./useWebSocket";

export function useTableState(tableId: string, inviteCode?: string | null) {
  const [tableState, setTableState] = useState<PublicTableView | null>(null);
  const [handResult, setHandResult] = useState<HandResultEvent | null>(null);
  const { socket, connected, on, emit } = useWebSocket(tableId, inviteCode);
  const recoveryAttempts = useRef(0);
  const recoveryTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribeTableState = on("TABLE_STATE", (...args: unknown[]) => {
      const payload = (args[0] || {}) as { state?: PublicTableView } | PublicTableView;
      const nextState = (payload as { state?: PublicTableView }).state ?? (payload as PublicTableView);
      if (!nextState) return;

      // Got a state; reset recovery backoff
      recoveryAttempts.current = 0;
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
        recoveryTimer.current = null;
      }

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

  // Auto-recovery: if TABLE_STATE doesn’t arrive soon, retry JOIN_TABLE and clear stale invite for this table
  useEffect(() => {
    if (!connected) return () => {};

    const attemptRecovery = () => {
      if (recoveryAttempts.current >= 3) return; // cap retries

      // clear invite for this table (it might be wrong/stale)
      if (typeof window !== "undefined" && tableId) {
        localStorage.removeItem(`tableInvite:${tableId}`);
      }

      recoveryAttempts.current += 1;
      emit("JOIN_TABLE", { tableId, inviteCode });

      // schedule next check only if still no state
      recoveryTimer.current = setTimeout(() => {
        if (!tableState) attemptRecovery();
      }, 1500);
    };

    // If no tableState arrives shortly after connect, start recovery
    recoveryTimer.current = setTimeout(() => {
      if (!tableState) attemptRecovery();
    }, 1500);

    return () => {
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
      recoveryTimer.current = null;
    };
  }, [connected, emit, inviteCode, tableId, tableState]);

  const startGame = useCallback(() => {
    if (connected) {
      emit("GAME_START", { tableId });
    }
  }, [connected, emit, tableId]);

  return { tableState, handResult, clearHandResult: () => setHandResult(null), connected, startGame };
}
