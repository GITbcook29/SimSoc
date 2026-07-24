"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGame } from "./game-context";
import { TOAST_KIND } from "@/lib/tokens";

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
    <div className="sticky top-0 z-10 bg-[var(--panel-2)]/95 backdrop-blur border-b border-[var(--line-2)]">
      <div className="bg-gradient-to-b from-[#101a2e] to-[#0d1526] border-b border-[var(--line-2)]">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[13px] font-bold tracking-[1.5px]">
            ◉ SIM<span className="text-[var(--accent)]">SOC</span>
          </span>
          <div className="min-w-0">
            <Link
              href="/games"
              className="font-mono text-[10.5px] text-[var(--faint)] hover:text-[var(--accent)]"
            >
              ← all games
            </Link>
            <h1 className="text-sm font-semibold truncate">{gameName}</h1>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap font-mono">
            <span className="flex items-center gap-2 text-[11px] font-bold text-red-400 bg-[var(--inset)] border border-red-500/40 rounded-lg px-2.5 py-1">
              <span className="w-[7px] h-[7px] rounded-full bg-red-400 simsoc-pulse" />
              SESSION {game.current_round} · LIVE
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-400 bg-[var(--inset)] border border-[var(--line-2)] rounded-lg px-2.5 py-1">
              POP <b className="text-[12.5px] text-[var(--foreground)]">{pop}</b>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-400 bg-[var(--inset)] border border-[var(--line-2)] rounded-lg px-2.5 py-1">
              LVL <b className="text-[12.5px] text-[var(--foreground)]">{level}</b>
            </span>
          </div>
        </div>
      </div>
      <nav className="max-w-6xl mx-auto px-4 flex gap-0.5 overflow-x-auto">
        {TABS.map(([id, label]) => {
          const href = `/games/${gameId}/${id}`;
          const active = pathname === href;
          return (
            <Link
              key={id}
              href={href}
              className={`text-[12.5px] px-3 py-2.5 whitespace-nowrap border-b-2 ${
                active
                  ? "text-[var(--accent)] border-[var(--accent)] font-semibold"
                  : "text-neutral-500 border-transparent hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${TOAST_KIND[t.kind].bg} text-white text-sm rounded-lg px-4 py-2 shadow-lg flex items-center gap-2`}
          >
            <span className="font-bold">{TOAST_KIND[t.kind].icon}</span>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
