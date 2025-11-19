"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage } from "@/lib/types";
import { useWebSocket } from "./useWebSocket";
import { apiClient } from "@/lib/apiClient";

export function useChat(tableId: string, inviteCode?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { socket, connected, emit, on } = useWebSocket(tableId, inviteCode);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await apiClient.get<ChatMessage[]>(
          `/api/tables/${tableId}/chat`
        );
        setMessages(history);
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    if (tableId) {
      loadHistory();
    }
  }, [tableId]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !connected) return;

    const unsubscribe = on("CHAT_MESSAGE", (payload: { message: ChatMessage }) => {
      setMessages((prev) => [...prev, payload.message]);
    });

    return () => {
      unsubscribe?.();
    };
  }, [socket, connected, on]);

  const sendMessage = useCallback(
    (message: string) => {
      if (connected && message.trim()) {
        emit("CHAT_SEND", { tableId, content: message });
      }
    },
    [connected, emit, tableId]
  );

  return { messages, sendMessage, connected };
}
