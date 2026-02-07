"use client";

import { useEffect, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket, disconnectSocket, refreshAndReconnect } from "@/lib/wsClient";

export function useWebSocket(tableId?: string, inviteCode?: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableId) return;

    let mounted = true;
    let wsRef: Socket | null = null;

    const attachHandlers = (ws: Socket) => {
      ws.on("connect", () => {
        setConnected(true);
        setError(null);
        if (tableId) {
          ws.emit("JOIN_TABLE", { tableId, inviteCode });
        }
      });

      ws.on("disconnect", () => {
        setConnected(false);
      });

      ws.on("connect_error", async (err) => {
        setError(err.message);
        setConnected(false);

        // Try to refresh session/token and reconnect when expired/invalid
        if (err.message?.toUpperCase().includes("TOKEN_EXPIRED") || err.message?.toUpperCase().includes("INVALID_TOKEN")) {
          try {
            const newWs = await refreshAndReconnect();
            if (!mounted) return;
            wsRef = newWs;
            setSocket(newWs);
            attachHandlers(newWs);
          } catch (refreshErr) {
            setError(refreshErr instanceof Error ? refreshErr.message : "Failed to refresh session");
          }
        }
      });
    };

    const connect = async () => {
      try {
        const ws = await getSocket();
        wsRef = ws;
        if (!mounted) return;

        attachHandlers(ws);
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
  }, [tableId, inviteCode]);

  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socket && connected) {
        socket.emit(event, data);
      }
    },
    [socket, connected]
  );

  const on = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: string, handler: (...args: any[]) => void) => {
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
