"use client";

import type { PlayerState } from "@/lib/types";

interface PlayerSeatProps {
  player: PlayerState;
  position: number;
  totalSeats: number;
  isCurrentUser: boolean;
  isActive: boolean;
  isDealer: boolean;
}

export function PlayerSeat({
  player,
  position,
  totalSeats,
  isCurrentUser,
  isActive,
  isDealer,
}: PlayerSeatProps) {
  // Calculate position around the table (circular layout)
  const angle = (position / totalSeats) * 2 * Math.PI - Math.PI / 2;
  const radius = 45; // percentage from center
  const x = 50 + radius * Math.cos(angle);
  const y = 50 + radius * Math.sin(angle);

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${x}%`,
        top: `${y}%`,
      }}
    >
      <div
        className={`p-3 rounded-lg border-2 min-w-[120px] ${
          isCurrentUser
            ? "bg-emerald-800 border-emerald-500"
            : "bg-slate-800 border-slate-600"
        } ${isActive ? "ring-2 ring-yellow-400" : ""}`}
      >
        {isDealer && (
          <div className="absolute -top-2 -right-2 bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">
            D
          </div>
        )}
        <div className="text-sm font-semibold text-slate-50">
          Player {position + 1}
        </div>
        <div className="text-xs text-slate-300">Chips: {player.chips}</div>
        {player.bet > 0 && (
          <div className="text-xs text-yellow-400">Bet: {player.bet}</div>
        )}
        {player.isAllIn && (
          <div className="text-xs text-red-400 font-bold">ALL IN</div>
        )}
      </div>
    </div>
  );
}


