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
  const { error } = await supabase.from("games").insert({ id, name, owner_id: user.id });

  if (error) throw error;
  revalidatePath("/games");
  redirect(`/games/${id}/setup`);
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
