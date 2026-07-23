import { redirect } from "next/navigation";

export default async function GameRootPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/games/${id}/setup`);
}
