"use client";

import { useState, useEffect } from "react";
import type { TableState } from "@/lib/types";
import { useWebSocket } from "./useWebSocket";

export function useTableState(tableId: string) {
  const [tableState, setTableState] = useState<TableState | null>(null);
  const { socket, connected, on } = useWebSocket(tableId);

  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribeTableState = on("TABLE_STATE", (state: TableState) => {
      setTableState(state);
    });

    const unsubscribeActionTaken = on("ACTION_TAKEN", (state: TableState) => {
      setTableState(state);
    });

    const unsubscribeHandResult = on("HAND_RESULT", (state: TableState) => {
      setTableState(state);
    });

    return () => {
      unsubscribeTableState?.();
      unsubscribeActionTaken?.();
      unsubscribeHandResult?.();
    };
  }, [socket, connected, on]);

  return { tableState, connected };
}


