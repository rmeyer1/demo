"use client";

import { Button } from "@/components/ui/Button";
import type { HandResultEvent, PublicSeatView } from "@/lib/types";

interface HandResultOverlayProps {
  result: HandResultEvent;
  seats: PublicSeatView[];
  onClose: () => void;
}

export function HandResultOverlay({ result, seats, onClose }: HandResultOverlayProps) {
  const lookupName = (seatIndex: number) =>
    seats.find((s) => s.seatIndex === seatIndex)?.displayName || `Seat ${seatIndex + 1}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-50">Hand Result</h3>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-3">
          {result.winners.map((winner) => (
            <div
              key={`${result.handId}-${winner.seatIndex}`}
              className="border border-emerald-700 bg-emerald-900/40 rounded-lg p-3"
            >
              <div className="flex justify-between text-sm text-slate-100">
                <span>{lookupName(winner.seatIndex)}</span>
                <span className="text-emerald-300 font-semibold">+{winner.wonAmount}</span>
              </div>
              <div className="text-xs text-slate-300">
                {winner.handRank} • {winner.handDescription}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-slate-400">Hand ID: {result.handId}</div>
      </div>
    </div>
  );
}
