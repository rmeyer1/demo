"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTableState } from "@/hooks/useTableState";
import { useChat } from "@/hooks/useChat";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiClient } from "@/lib/apiClient";
import type { Table } from "@/lib/types";
import { PokerTable } from "@/components/table/PokerTable";
import { ActionControls } from "@/components/table/ActionControls";
import { TableHud } from "@/components/table/TableHud";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { tableState, connected } = useTableState(tableId);
  const { messages, sendMessage, connected: chatConnected } = useChat(tableId);
  const { emit } = useWebSocket(tableId);

  const { data: table, isLoading } = useQuery({
    queryKey: ["table", tableId],
    queryFn: () => apiClient.get<Table>(`/api/tables/${tableId}`),
    enabled: !!tableId && !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  const handleAction = (
    action: "fold" | "check" | "call" | "bet" | "raise",
    amount?: number
  ) => {
    emit("PLAYER_ACTION", {
      tableId,
      action,
      amount,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="text-center text-slate-400 py-12">Loading table...</div>
    );
  }

  if (!table || !user) {
    return null;
  }

  if (!tableState) {
    return (
      <div className="text-center text-slate-400 py-12">
        Waiting for table state...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <TableHud tableName={table.name} tableState={tableState} />

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <PokerTable tableState={tableState} currentUserId={user.id} />
          <div className="mt-6">
            <ActionControls
              tableState={tableState}
              currentUserId={user.id}
              onAction={handleAction}
            />
          </div>
        </div>
        <div className="lg:col-span-1">
          <ChatPanel
            messages={messages}
            onSendMessage={sendMessage}
            connected={chatConnected}
          />
        </div>
      </div>
    </div>
  );
}


