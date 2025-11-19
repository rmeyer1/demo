"use client";

import type { PublicTableView, Table } from "@/lib/types";

interface TableHudProps {
  tableName: string;
  tableMeta: Table;
  tableState: PublicTableView;
}

export function TableHud({ tableName, tableMeta, tableState }: TableHudProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{tableName}</h2>
          <p className="text-sm text-slate-400">Blinds {tableMeta.smallBlind}/{tableMeta.bigBlind}</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-slate-400">Street: </span>
            <span className="text-slate-50 font-semibold">
              {tableState.street ?? "WAITING"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Pot: </span>
            <span className="text-slate-50 font-semibold">{tableState.potTotal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
