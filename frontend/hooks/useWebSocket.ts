"use client";

import { useEffect, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/lib/wsClient";

export function useWebSocket(tableId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableId) return;

    let mounted = true;
    let wsRef: Socket | null = null;

    const connect = async () => {
      try {
        const ws = await getSocket();
        wsRef = ws;
        if (!mounted) return;

        ws.on("connect", () => {
          setConnected(true);
          setError(null);
          if (tableId) {
            ws.emit("JOIN_TABLE", { tableId });
          }
        });

        ws.on("disconnect", () => {
          setConnected(false);
        });

        ws.on("connect_error", (err) => {
          setError(err.message);
          setConnected(false);
        });

        setSocket(ws);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to connect");
          setConnected(false);
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      if (wsRef && tableId) {
        wsRef.emit("LEAVE_TABLE", { tableId });
      }
      disconnectSocket();
    };
  }, [tableId]);

  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socket && connected) {
        socket.emit(event, data);
      }
    },
    [socket, connected]
  );

  const on = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      if (socket) {
        socket.on(event, handler);
        return () => {
          socket.off(event, handler);
        };
      }
    },
    [socket]
  );

  return { socket, connected, error, emit, on };
}
