import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";
import { GameProvider } from "./game-context";
import { GameNav } from "./GameNav";

export default async function GameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: game } = await supabase.from("games").select("*").eq("id", id).single();

  if (!game) notFound();

  return (
    <GameProvider gameId={id} initialGame={game as Game}>
      <div className="flex-1 flex flex-col">
        <GameNav gameId={id} gameName={game.name} />
        <main className="flex-1 max-w-6xl w-full mx-auto p-6">{children}</main>
      </div>
    </GameProvider>
  );
}
