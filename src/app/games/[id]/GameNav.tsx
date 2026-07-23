"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGame } from "./game-context";

const TABS: [string, string][] = [
  ["setup", "Setup"],
  ["session", "Session"],
  ["disaster", "Disaster"],
  ["election", "Election"],
  ["results", "Results"],
  ["masmed", "MasMed Report"],
  ["history", "History"],
  ["status", "Status"],
  ["cheatsheet", "Cheat Sheet"],
];

export function GameNav({ gameId, gameName }: { gameId: string; gameName: string }) {
  const pathname = usePathname();
  const { game, pop, level, toasts } = useGame();

  return (
    <div className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
        <div>
          <Link href="/games" className="text-xs text-neutral-400 hover:underline">
            ← all games
          </Link>
          <h1 className="text-sm font-semibold">{gameName}</h1>
        </div>
        <nav className="flex gap-1 flex-wrap ml-auto">
          {TABS.map(([id, label]) => {
            const href = `/games/${gameId}/${id}`;
            const active = pathname === href;
            return (
              <Link
                key={id}
                href={href}
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  active ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-600 border-neutral-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-2 flex gap-4 text-xs text-neutral-500">
        <span>Session {game.current_round}</span>
        <span>Pop {pop}</span>
        <span>Level {level}</span>
      </div>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className="bg-black text-white text-sm rounded-lg px-4 py-2 shadow-lg">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
