import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function GameSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: game } = await supabase.from("games").select("id, name").eq("id", id).single();

  if (!game) notFound();

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{game.name}</h1>
      <p className="text-sm text-neutral-500">
        Roster, sessions, disaster/election, results and the rest of the tabs land here in Phase 4.
      </p>
    </div>
  );
}
