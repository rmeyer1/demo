"use client";

interface PotDisplayProps {
  potTotal: number;
}

export function PotDisplay({ potTotal }: PotDisplayProps) {
  return (
    <div className="bg-slate-900 border-2 border-yellow-500 rounded-lg px-6 py-3">
      <div className="text-sm text-slate-400">Pot</div>
      <div className="text-2xl font-bold text-yellow-400">{potTotal}</div>
    </div>
  );
}
