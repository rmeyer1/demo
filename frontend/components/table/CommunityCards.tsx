"use client";

interface CommunityCardsProps {
  cards: string[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 mb-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className="w-16 h-24 bg-white rounded-lg border-2 border-slate-300 flex items-center justify-center text-slate-900 font-bold text-lg shadow-lg"
        >
          {card}
        </div>
      ))}
    </div>
  );
}


