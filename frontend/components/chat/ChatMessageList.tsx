"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatMessageListProps {
  messages: ChatMessage[];
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px] max-h-[400px]"
    >
      {messages.length === 0 ? (
        <p className="text-center text-slate-500 text-sm">No messages yet</p>
      ) : (
        messages.map((message) => (
          <div key={message.id} className="text-sm">
            <span className="text-emerald-400 font-semibold">
              {message.userName}:
            </span>{" "}
            <span className="text-slate-300">{message.message}</span>
            <span className="text-slate-500 text-xs ml-2">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))
      )}
    </div>
  );
}


