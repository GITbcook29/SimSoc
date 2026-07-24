"use client";

import { deleteGame } from "./actions";

// Owner-only. Uses a <form action> (same pattern as the invite form) so the
// server action's revalidatePath reliably refreshes the list. The confirm guard
// runs before submit; the hard delete cascades to participants, rounds, heads,
// and invites (FK ON DELETE CASCADE), so it is irreversible.
export function DeleteGameButton({ gameId, gameName }: { gameId: string; gameName: string }) {
  return (
    <form
      action={deleteGame.bind(null, gameId)}
      onSubmit={(e) => {
        const ok = confirm(
          `Delete “${gameName}”?\n\nThis permanently removes the game and ALL of its participants, sessions, results, and history. This cannot be undone.`
        );
        if (!ok) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="text-xs text-red-400 border border-red-500/40 rounded px-3 py-1.5 hover:bg-red-500/10"
      >
        Delete
      </button>
    </form>
  );
}
