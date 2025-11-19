"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PublicTableView } from "@/lib/types";

interface ActionControlsProps {
  tableState: PublicTableView;
  onAction: (action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE", amount?: number) => void;
}

export function ActionControls({ tableState, onAction }: ActionControlsProps) {
  const [betAmount, setBetAmount] = useState("");
  const selfSeat = tableState.seats.find((s) => s.isSelf);
  const isMyTurn =
    selfSeat !== undefined && tableState.toActSeatIndex === selfSeat.seatIndex;

  const callAmount = tableState.callAmount ?? 0;
  const minBet = tableState.minBet ?? 0;

  if (!selfSeat) {
    return (
      <div className="text-center text-slate-400 py-4">
        Take a seat to act at this table.
      </div>
    );
  }

  if (!isMyTurn || !tableState.handId) {
    return (
      <div className="text-center text-slate-400 py-4">
        {tableState.handId ? "Waiting for your turn..." : "Waiting for next hand..."}
      </div>
    );
  }

  const maxBet = selfSeat.stack;
  const clampedCall = Math.min(callAmount, selfSeat.stack);

  const handleBet = () => {
    const amount = parseInt(betAmount);
    if (!Number.isFinite(amount)) return;
    if (amount >= minBet && amount <= maxBet) {
      onAction(amount > minBet ? "RAISE" : "BET", amount);
      setBetAmount("");
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <div className="flex flex-col gap-4">
        <div className="text-center text-slate-300">
          <p>Your turn • Call: {clampedCall} • Min bet: {minBet}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="danger" onClick={() => onAction("FOLD")}>
            Fold
          </Button>
          {clampedCall === 0 ? (
            <Button onClick={() => onAction("CHECK")}>Check</Button>
          ) : (
            <Button onClick={() => onAction("CALL")}>
              Call {clampedCall}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Bet amount"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            min={minBet}
            max={maxBet}
          />
          <Button onClick={handleBet}>Bet/Raise</Button>
        </div>
      </div>
    </div>
  );
}
