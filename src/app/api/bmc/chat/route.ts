import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/bmc/auth";
import {
  HISTORY_LIMIT,
  MAX_TOOL_ROUNDS,
  MODEL,
  SAVE_TASK_TOOL,
  buildSystemPrompt,
} from "@/lib/bmc/assistant";
import type {
  ChatMessage,
  CohortSession,
  ParticipantTask,
  StoredFile,
} from "@/lib/bmc/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Block = Anthropic.Messages.ContentBlockParam;

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) {
    return new NextResponse("Not authorized", { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new NextResponse(
      "The assistant isn't configured yet — ANTHROPIC_API_KEY is not set.",
      { status: 503 },
    );
  }

  const body = (await request.json()) as { message?: unknown };
  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return new NextResponse("Message is required", { status: 400 });
  }

  const supabase = await createClient();

  // Scoped context: this participant's own data only.
  const [{ data: historyData }, { data: sessionData }, { data: taskData }, { data: fileData }] =
    await Promise.all([
      supabase
        .from("bmc_chat_messages")
        .select("id, participant_id, role, content, created_at")
        .eq("participant_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase
        .from("bmc_sessions")
        .select(
          "id, session_number, session_date, title, arena_block, exit_momentum_block, breakout_takeaway, mentor_focus, recording_url, location, prep_checklist, status, published",
        )
        .eq("published", true)
        .order("session_number"),
      supabase
        .from("bmc_participant_tasks")
        .select("id, participant_id, source_session_id, text, due_date, done")
        .eq("participant_id", profile.id)
        .order("due_date", { nullsFirst: false }),
      supabase
        .from("bmc_files")
        .select("id, owner_id, storage_path, filename, mime, size, scope, created_at")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);

  const history = ((historyData ?? []) as ChatMessage[]).slice().reverse();

  const system = buildSystemPrompt({
    profile,
    sessions: (sessionData ?? []) as CohortSession[],
    tasks: (taskData ?? []) as ParticipantTask[],
    files: (fileData ?? []) as StoredFile[],
  });

  await supabase.from("bmc_chat_messages").insert({
    participant_id: profile.id,
    role: "user",
    content: userMessage,
  });

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const anthropic = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const turn = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system,
            messages,
            tools: [SAVE_TASK_TOOL],
            // Adaptive thinking at low effort: enough reasoning for planning
            // help, without the latency of a deep think on every chat turn.
            thinking: { type: "adaptive" },
            output_config: { effort: "low" },
          });

          turn.on("text", (delta) => {
            assistantText += delta;
            controller.enqueue(encoder.encode(delta));
          });

          const final = await turn.finalMessage();

          if (final.stop_reason !== "tool_use") break;

          const toolUses = final.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
          );
          if (toolUses.length === 0) break;

          const results: Block[] = [];

          for (const use of toolUses) {
            if (use.name !== SAVE_TASK_TOOL.name) {
              results.push({
                type: "tool_result",
                tool_use_id: use.id,
                content: `Unknown tool: ${use.name}`,
                is_error: true,
              });
              continue;
            }

            const input = use.input as { text?: string; due_date?: string };
            const text = (input.text ?? "").trim();

            if (!text) {
              results.push({
                type: "tool_result",
                tool_use_id: use.id,
                content: "A task needs some text.",
                is_error: true,
              });
              continue;
            }

            const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.due_date ?? "")
              ? input.due_date
              : null;

            const { error } = await supabase.from("bmc_participant_tasks").insert({
              participant_id: profile.id,
              text,
              due_date: dueDate,
              created_by: profile.id,
            });

            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: error
                ? `Could not save the task: ${error.message}`
                : "Saved to their dashboard.",
              is_error: Boolean(error),
            });
          }

          messages.push({ role: "assistant", content: final.content });
          messages.push({ role: "user", content: results });
        }
      } catch (error) {
        const note =
          error instanceof Error
            ? `\n\n[The assistant hit an error: ${error.message}]`
            : "\n\n[The assistant hit an unexpected error.]";
        assistantText += note;
        controller.enqueue(encoder.encode(note));
      } finally {
        if (assistantText.trim()) {
          await supabase.from("bmc_chat_messages").insert({
            participant_id: profile.id,
            role: "assistant",
            content: assistantText,
          });
        }
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
