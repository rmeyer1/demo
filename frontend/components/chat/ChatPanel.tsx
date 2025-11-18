"use client";

import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  connected: boolean;
}

export function ChatPanel({
  messages,
  onSendMessage,
  connected,
}: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full bg-slate-800 border border-slate-700 rounded-lg">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-slate-50">Chat</h3>
        {!connected && (
          <p className="text-xs text-red-400">Disconnected</p>
        )}
      </div>
      <ChatMessageList messages={messages} />
      <ChatInput onSend={onSendMessage} disabled={!connected} />
    </div>
  );
}


