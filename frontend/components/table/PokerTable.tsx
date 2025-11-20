"use client";

import { useMemo } from "react";
import { PlayerSeat } from "./PlayerSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";
import type { PublicTableView, Table } from "@/lib/types";

interface PokerTableProps {
  tableState: PublicTableView;
  tableMeta: Table;
  canSelectSeat?: boolean;
  onSeatSelect?: (seatIndex: number) => void;
}

export function PokerTable({ tableState, tableMeta, canSelectSeat = false, onSeatSelect }: PokerTableProps) {
  const occupancy = useMemo(() => {
    const map = new Map<number, boolean>();
    (tableMeta.seats || []).forEach((seat) => {
      map.set(seat.seatIndex, Boolean(seat.userId));
    });
    return map;
  }, [tableMeta.seats]);

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
          {tableState.seats.map((seat) => {
            const isVacant = !(occupancy.get(seat.seatIndex) ?? true);
            return (
              <PlayerSeat
                key={seat.seatIndex}
                seat={seat}
                position={seat.seatIndex}
                totalSeats={tableMeta.maxPlayers}
                isActive={tableState.toActSeatIndex === seat.seatIndex}
                isVacant={isVacant}
                canSelectSeat={canSelectSeat}
                onSelectSeat={onSeatSelect}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
