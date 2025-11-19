"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { HandResultOverlay } from "@/components/table/HandResultOverlay";

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = params.id as string;
  const inviteCode = searchParams.get("inviteCode");
  const { user, loading: authLoading } = useAuth();
  const { tableState, handResult, clearHandResult, connected } = useTableState(tableId, inviteCode);
  const { messages, sendMessage, connected: chatConnected } = useChat(tableId, inviteCode);
  const { emit } = useWebSocket(tableId, inviteCode);
  const [actionError, setActionError] = useState<string | null>(null);

  // Persist invite code so reloads/reconnects keep access
  useEffect(() => {
    if (inviteCode && tableId) {
      localStorage.setItem(`tableInvite:${tableId}`, inviteCode);
    }
  }, [inviteCode, tableId]);

  const storedInvite = typeof window !== "undefined" && tableId
    ? localStorage.getItem(`tableInvite:${tableId}`)
    : null;
  const effectiveInvite = inviteCode || storedInvite || null;

  const { data: table, isLoading } = useQuery({
    queryKey: ["table", tableId, effectiveInvite],
    queryFn: () =>
      apiClient.get<Table>(
        `/api/tables/${tableId}${effectiveInvite ? `?inviteCode=${encodeURIComponent(effectiveInvite)}` : ""}`
      ),
    enabled: !!tableId && !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  const handleAction = (
    action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE",
    amount?: number
  ) => {
    setActionError(null);
    if (!tableState) return;

    // Basic client-side validation to reduce server rejections
    if (!tableState.handId) {
      setActionError("Hand not active yet.");
      return;
    }

    const selfSeat = tableState.seats.find((s) => s.isSelf);
    if (!selfSeat || tableState.toActSeatIndex !== selfSeat.seatIndex) {
      setActionError("Not your turn.");
      return;
    }

    if (action === "CHECK" && (tableState.callAmount || 0) > 0) {
      setActionError("Cannot check when facing a bet.");
      return;
    }

    if (action === "CALL" && (tableState.callAmount || 0) === 0) {
      setActionError("Nothing to call.");
      return;
    }

    if ((action === "BET" || action === "RAISE") && (!amount || amount < (tableState.minBet || 0))) {
      setActionError(`Bet/Raise must be at least ${tableState.minBet || 0}.`);
      return;
    }

    emit("PLAYER_ACTION", {
      tableId,
      handId: tableState.handId,
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
      <TableHud tableName={table.name} tableMeta={table} tableState={tableState} />

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <PokerTable tableState={tableState} tableMeta={table} />
          <div className="mt-6">
            <ActionControls
              tableState={tableState}
              onAction={handleAction}
            />
            {actionError && (
              <p className="text-red-400 text-sm mt-2 text-center">{actionError}</p>
            )}
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

      {handResult && (
        <HandResultOverlay
          result={handResult}
          seats={tableState.seats}
          onClose={clearHandResult}
        />
      )}

      {!connected && (
        <div className="mt-4 text-center text-amber-300 text-sm">
          Reconnecting to table...
        </div>
      )}

      {tableState.seats.find((s) => s.isSelf) &&
        tableState.toActSeatIndex === tableState.seats.find((s) => s.isSelf)?.seatIndex && (
          <div className="mt-4 text-center text-emerald-300 text-sm">
            Your turn to act.
          </div>
        )}
    </div>
  );
}
