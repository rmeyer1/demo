"use client";

import { PlayerSeat } from "./PlayerSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";
import type { TableState } from "@/lib/types";

interface PokerTableProps {
  tableState: TableState;
  currentUserId: string;
}

export function PokerTable({ tableState, currentUserId }: PokerTableProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[4/3]">
      {/* Table surface */}
      <div className="absolute inset-0 bg-emerald-900 rounded-full border-8 border-emerald-700 shadow-2xl flex items-center justify-center">
        {/* Community cards and pot in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CommunityCards cards={tableState.communityCards} />
          <PotDisplay pot={tableState.pot} />
        </div>

        {/* Player seats arranged in a circle */}
        <div className="absolute inset-0">
          {tableState.players.map((player) => (
            <PlayerSeat
              key={player.userId}
              player={player}
              position={player.position}
              totalSeats={tableState.players.length}
              isCurrentUser={player.userId === currentUserId}
              isActive={player.position === tableState.activePlayerPosition}
              isDealer={player.position === tableState.dealerPosition}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


