"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTableState } from "@/hooks/useTableState";
import { useChat } from "@/hooks/useChat";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { Table } from "@/lib/types";
import { PokerTable } from "@/components/table/PokerTable";
import { ActionControls } from "@/components/table/ActionControls";
import { TableHud } from "@/components/table/TableHud";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { HandResultOverlay } from "@/components/table/HandResultOverlay";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tableId = params.id as string;
  const inviteCode = searchParams.get("inviteCode");
  const { user, loading: authLoading } = useAuth();
  const storedInvite = typeof window !== "undefined" && tableId
    ? localStorage.getItem(`tableInvite:${tableId}`)
    : null;
  const effectiveInvite = inviteCode || storedInvite || null;

  const { tableState, handResult, clearHandResult, connected } = useTableState(tableId, effectiveInvite);
  const { messages, sendMessage, connected: chatConnected } = useChat(tableId, effectiveInvite);
  const { emit } = useWebSocket(tableId, effectiveInvite);
  const [actionError, setActionError] = useState<string | null>(null);
  const [seatPrompt, setSeatPrompt] = useState<{ seatIndex: number } | null>(null);
  const [buyInAmount, setBuyInAmount] = useState("");
  const [seatError, setSeatError] = useState<string | null>(null);
  const [seatSubmitting, setSeatSubmitting] = useState(false);

  // Persist invite code so reloads/reconnects keep access
  useEffect(() => {
    if (inviteCode && tableId) {
      localStorage.setItem(`tableInvite:${tableId}`, inviteCode);
    }
  }, [inviteCode, tableId]);

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

  const isSeated = useMemo(
    () => tableState?.seats.some((s) => s.isSelf) ?? false,
    [tableState]
  );

  const handleSeatSelect = (seatIndex: number) => {
    if (isSeated || !table) return;
    if (!buyInAmount) {
      const defaultBuyIn = Math.max(table.bigBlind * 20, table.bigBlind * 2);
      setBuyInAmount(String(defaultBuyIn));
    }
    setSeatPrompt({ seatIndex });
    setSeatError(null);
  };

  const closeSeatPrompt = () => {
    if (seatSubmitting) return;
    setSeatPrompt(null);
    setSeatError(null);
  };

  const confirmSeatSelection = async () => {
    if (!seatPrompt) return;
    const amount = Number(buyInAmount);
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setSeatError("Enter a buy-in greater than zero.");
      return;
    }

    setSeatSubmitting(true);
    setSeatError(null);
    try {
      await apiClient.post(`/api/tables/${tableId}/sit-down`, {
        seatIndex: seatPrompt.seatIndex,
        buyInAmount: amount,
      });
      await queryClient.invalidateQueries({ queryKey: ["table", tableId, effectiveInvite] });
      setSeatPrompt(null);
      setBuyInAmount("");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to take seat.";
      setSeatError(message);
    } finally {
      setSeatSubmitting(false);
    }
  };

  const mySeat = useMemo(
    () => tableState?.seats.find((s) => s.isSelf),
    [tableState]
  );

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
          <PokerTable
            tableState={tableState}
            tableMeta={table}
            canSelectSeat={!isSeated}
            onSeatSelect={handleSeatSelect}
          />
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

      {mySeat && tableState.toActSeatIndex === mySeat.seatIndex && (
        <div className="mt-4 text-center text-emerald-300 text-sm">
          Your turn to act.
        </div>
      )}

      <Modal
        isOpen={!!seatPrompt}
        onClose={closeSeatPrompt}
        title={
          seatPrompt !== null
            ? `Take Seat ${seatPrompt.seatIndex + 1}?`
            : "Take a Seat"
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Select your buy-in to take this seat and join the table.
          </p>
          <Input
            label="Buy-in Amount"
            type="number"
            min={1}
            value={buyInAmount}
            onChange={(e) => setBuyInAmount(e.target.value)}
            placeholder="Enter chips"
          />
          {seatError && (
            <div className="rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-200">
              {seatError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={closeSeatPrompt} disabled={seatSubmitting}>
              Cancel
            </Button>
            <Button onClick={confirmSeatSelection} disabled={seatSubmitting}>
              {seatSubmitting ? "Taking seat..." : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
