"use client";

import { useState, useEffect, useCallback } from "react";
import type { TableState } from "@/lib/types";
import { useWebSocket } from "./useWebSocket";

export function useTableState(tableId: string) {
  const [tableState, setTableState] = useState<TableState | null>(null);
  const { socket, connected, on, emit } = useWebSocket(tableId);

  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribeTableState = on("TABLE_STATE", (payload: { state?: TableState }) => {
      setTableState(payload.state ?? (payload as unknown as TableState));
    });

    const unsubscribeActionTaken = on("ACTION_TAKEN", () => {
      // ACTION_TAKEN broadcasts accompany a later TABLE_STATE; no-op here
    });

    const unsubscribeHandResult = on("HAND_RESULT", () => {
      // HAND_RESULT handled via TABLE_STATE update
    });

    return () => {
      unsubscribeTableState?.();
      unsubscribeActionTaken?.();
      unsubscribeHandResult?.();
    };
  }, [socket, connected, on]);

  const startGame = useCallback(() => {
    if (connected) {
      emit("GAME_START", { tableId });
    }
  }, [connected, emit, tableId]);

  return { tableState, connected, startGame };
}
