"use client";

import type { PublicSeatView } from "@/lib/types";

interface PlayerSeatProps {
  seat: PublicSeatView;
  position: number;
  totalSeats: number;
  isActive: boolean;
  isVacant: boolean;
  canSelectSeat?: boolean;
  onSelectSeat?: (seatIndex: number) => void;
}

export function PlayerSeat({
  seat,
  position,
  totalSeats,
  isActive,
  isVacant,
  canSelectSeat,
  onSelectSeat,
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
        className={`p-3 rounded-lg border-2 min-w-[140px] ${
          seat.isSelf
            ? "bg-emerald-800 border-emerald-500"
            : "bg-slate-800 border-slate-600"
        } ${isActive ? "ring-2 ring-yellow-400" : ""}`}
      >
        <div className="text-sm font-semibold text-slate-50">
          {seat.displayName || `Seat ${position + 1}`}
        </div>
        <div className="text-xs text-slate-300">Chips: {seat.stack}</div>
        {seat.status === "ALL_IN" && (
          <div className="text-xs text-red-400 font-bold">ALL IN</div>
        )}
        {seat.status === "FOLDED" && (
          <div className="text-xs text-slate-400">Folded</div>
        )}
        {seat.status === "SITTING_OUT" && (
          <div className="text-xs text-orange-300">Sitting out</div>
        )}
        {seat.isSelf && seat.status === "ACTIVE" && (
          <div className="text-xs text-emerald-200">You</div>
        )}
        {isVacant && canSelectSeat && !seat.isSelf && (
          <button
            className="mt-2 w-full rounded-md border border-emerald-400 bg-emerald-900/60 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-800/80"
            onClick={() => onSelectSeat?.(seat.seatIndex)}
            type="button"
          >
            Sit Here
          </button>
        )}
      </div>
    </div>
  );
}
