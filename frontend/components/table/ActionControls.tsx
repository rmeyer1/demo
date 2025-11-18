"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TableState } from "@/lib/types";

interface ActionControlsProps {
  tableState: TableState;
  currentUserId: string;
  onAction: (action: "fold" | "check" | "call" | "bet" | "raise", amount?: number) => void;
}

export function ActionControls({
  tableState,
  currentUserId,
  onAction,
}: ActionControlsProps) {
  const [betAmount, setBetAmount] = useState("");
  const currentPlayer = tableState.players.find(
    (p) => p.userId === currentUserId
  );

  if (!currentPlayer || !currentPlayer.isActive) {
    return (
      <div className="text-center text-slate-400 py-4">
        Waiting for your turn...
      </div>
    );
  }

  const minBet = tableState.currentBet;
  const maxBet = currentPlayer.chips;
  const callAmount = Math.min(minBet - currentPlayer.bet, currentPlayer.chips);

  const handleBet = () => {
    const amount = parseInt(betAmount);
    if (amount >= minBet && amount <= maxBet) {
      onAction(amount > minBet ? "raise" : "bet", amount);
      setBetAmount("");
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <div className="flex flex-col gap-4">
        <div className="text-center text-slate-300">
          <p>Your turn • Call: {callAmount} • Pot: {tableState.pot}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="danger" onClick={() => onAction("fold")}>
            Fold
          </Button>
          {callAmount === 0 ? (
            <Button onClick={() => onAction("check")}>Check</Button>
          ) : (
            <Button onClick={() => onAction("call")}>Call {callAmount}</Button>
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


