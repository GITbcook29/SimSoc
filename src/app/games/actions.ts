"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createGame(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  // Generate the id client-side and skip `.select()` (RETURNING): Postgres RLS
  // can't reliably apply a self-referencing SELECT policy to a row still being
  // inserted within the same statement, so RETURNING intermittently 403s here
  // even though the plain insert is allowed.
  const id = crypto.randomUUID();
  const config = { numSessions: 8, lockLevel: true, lockedLevel: null, sessionSort: "roster" };
  const { error } = await supabase.from("games").insert({ id, name, owner_id: user.id, config });

  if (error) throw error;
  revalidatePath("/games");
  redirect(`/games/${id}/setup`);
}

export async function renameGame(gameId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const { error } = await supabase
    .from("games")
    .update({ name })
    .eq("id", gameId)
    .eq("owner_id", user.id);
  if (error) throw error;
  revalidatePath("/games");
}

// Bound with the game id and used as a <form action>, so the extra FormData arg
// the form passes is simply ignored.
export async function deleteGame(gameId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owner-only. RLS also enforces this; the extra owner_id filter makes the
  // intent explicit and turns a non-owner attempt into a harmless no-op rather
  // than an error. FK ON DELETE CASCADE removes participants/rounds/heads/invites.
  const { error } = await supabase.from("games").delete().eq("id", gameId).eq("owner_id", user.id);
  if (error) throw error;
  revalidatePath("/games");
}

export async function inviteToGame(gameId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return;

  const { error } = await supabase
    .from("game_invites")
    .insert({ game_id: gameId, email, invited_by: user.id });

  if (error) throw error;
  revalidatePath("/games");
}
