"use client";

import { PlayerSeat } from "./PlayerSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";
import type { PublicTableView, Table } from "@/lib/types";

interface PokerTableProps {
  tableState: PublicTableView;
  tableMeta: Table;
}

export function PokerTable({ tableState, tableMeta }: PokerTableProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[4/3]">
      {/* Table surface */}
      <div className="absolute inset-0 bg-emerald-900 rounded-full border-8 border-emerald-700 shadow-2xl flex items-center justify-center">
        {/* Community cards and pot in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CommunityCards cards={tableState.communityCards} />
          <PotDisplay potTotal={tableState.potTotal} />
        </div>

        {/* Player seats arranged in a circle */}
        <div className="absolute inset-0">
          {tableState.seats.map((seat) => (
            <PlayerSeat
              key={seat.seatIndex}
              seat={seat}
              position={seat.seatIndex}
              totalSeats={tableMeta.maxPlayers}
              isActive={tableState.toActSeatIndex === seat.seatIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
