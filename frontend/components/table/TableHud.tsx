"use client";

import type { TableState } from "@/lib/types";

interface TableHudProps {
  tableName: string;
  tableState: TableState;
}

export function TableHud({ tableName, tableState }: TableHudProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{tableName}</h2>
          <p className="text-sm text-slate-400">Hand #{tableState.handNumber}</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-slate-400">Blinds: </span>
            <span className="text-slate-50 font-semibold">
              {tableState.smallBlind}/{tableState.bigBlind}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Street: </span>
            <span className="text-slate-50 font-semibold">
              {tableState.currentStreet}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


