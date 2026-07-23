import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createGame, inviteToGame } from "./actions";
import { signOut } from "@/app/login/actions";

export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: games } = await supabase
    .from("games")
    .select("id, name, owner_id, current_round, created_at")
    .order("created_at", { ascending: false });

  const ownedIds = (games ?? []).filter((g) => g.owner_id === user?.id).map((g) => g.id);

  const invitesByGame = new Map<string, { email: string }[]>();
  if (ownedIds.length) {
    const { data: invites } = await supabase
      .from("game_invites")
      .select("game_id, email")
      .in("game_id", ownedIds);
    for (const inv of invites ?? []) {
      const list = invitesByGame.get(inv.game_id) ?? [];
      list.push({ email: inv.email });
      invitesByGame.set(inv.game_id, list);
    }
  }

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your games</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-neutral-500 hover:underline">
            Sign out ({user?.email})
          </button>
        </form>
      </div>

      <form action={createGame} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="New game name, e.g. Fall 2026 Section A"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-black text-white rounded px-4 py-2 text-sm font-medium">
          New game
        </button>
      </form>

      <div className="space-y-4">
        {(games ?? []).length === 0 && (
          <p className="text-sm text-neutral-500">No games yet — create one above.</p>
        )}

        {(games ?? []).map((game) => {
          const isOwner = game.owner_id === user?.id;
          const invites = invitesByGame.get(game.id) ?? [];
          return (
            <div key={game.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/games/${game.id}/setup`} className="font-medium hover:underline">
                    {game.name}
                  </Link>
                  <p className="text-xs text-neutral-500">
                    Round {game.current_round} {isOwner ? "· you own this game" : "· shared with you"}
                  </p>
                </div>
              </div>

              {isOwner && (
                <div className="border-t pt-3 space-y-2">
                  <form action={inviteToGame.bind(null, game.id)} className="flex gap-2">
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="Invite teammate by email"
                      className="flex-1 border rounded px-2 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      className="border rounded px-3 py-1.5 text-xs font-medium"
                    >
                      Invite
                    </button>
                  </form>
                  {invites.length > 0 && (
                    <p className="text-xs text-neutral-500">
                      Pending: {invites.map((i) => i.email).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
