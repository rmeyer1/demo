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
  startControl?: {
    seatIndex: number;
    pending: boolean;
    error?: string | null;
    onStart: () => void;
  } | null;
  standControl?: {
    seatIndex: number;
    disabled: boolean;
    disabledReason?: string | null;
    pending?: boolean;
    error?: string | null;
    onStand: () => void;
  } | null;
}

export function PokerTable({ tableState, tableMeta, canSelectSeat = false, onSeatSelect, startControl, standControl }: PokerTableProps) {
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
            const seatStartControl =
              startControl && startControl.seatIndex === seat.seatIndex ? startControl : undefined;
            const seatStandControl =
              standControl && standControl.seatIndex === seat.seatIndex ? standControl : undefined;
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
                startControl={seatStartControl}
                standControl={seatStandControl}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
