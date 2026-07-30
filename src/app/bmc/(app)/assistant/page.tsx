import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/bmc/auth";
import type { ChatMessage } from "@/lib/bmc/types";
import { Card, Eyebrow, PageHeader } from "@/components/bmc/ui";
import { AssistantChat } from "@/components/bmc/AssistantChat";

export default async function AssistantPage() {
  const me = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bmc_chat_messages")
    .select("id, participant_id, role, content, created_at")
    .eq("participant_id", me.id)
    .order("created_at", { ascending: true });

  const history = (data ?? []) as ChatMessage[];
  const configured = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <PageHeader
        eyebrow="Private to you"
        title="Assistant"
        hint="A working partner for your business and your journey through the program. It can see the schedule, your tasks, and your file names — nothing about other participants."
      />

      {!configured && (
        <p className="mb-4 text-[13px] rounded-md px-3 py-2 border border-[var(--amber)] text-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)]">
          The assistant isn&apos;t configured yet — ANTHROPIC_API_KEY needs to be
          set on the deployment.
        </p>
      )}

      <Card>
        <AssistantChat initial={history} />
      </Card>

      <Eyebrow className="mt-4">
        Conversations are saved so you can pick up where you left off.
      </Eyebrow>
    </>
  );
}
