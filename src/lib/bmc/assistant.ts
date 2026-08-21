import {
  PROGRAM_NAME,
  PROGRAM_TERM,
  SESSION_END_TIME,
  SESSION_START_TIME,
} from "./config";
import type { CohortSession, ParticipantTask, Profile, StoredFile } from "./types";
import { formatSessionDate } from "./sessions";

/** Sonnet-class default; override per environment with ANTHROPIC_MODEL. */
export const DEFAULT_MODEL = "claude-sonnet-5";

export const MODEL = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

/** How much prior conversation to replay on each turn. */
export const HISTORY_LIMIT = 40;

export const MAX_TOOL_ROUNDS = 3;

export type AssistantContext = {
  profile: Profile;
  sessions: CohortSession[];
  tasks: ParticipantTask[];
  files: StoredFile[];
};

/**
 * Everything the assistant knows, assembled per request. Note what is *not*
 * here: other participants' data, the leads pipeline, and the pricing model.
 * The guardrail is structural — that data never enters the prompt — and the
 * instructions below reinforce it.
 */
export function buildSystemPrompt(ctx: AssistantContext): string {
  const { profile, sessions, tasks, files } = ctx;

  const scheduleLines = sessions.length
    ? sessions
        .map((s) => {
          const parts = [
            `Session ${s.session_number} — ${formatSessionDate(s.session_date)}`,
            s.title ? `theme: ${s.title}` : null,
            s.arena_block?.topic ? `Arena curriculum: ${s.arena_block.topic}` : null,
            s.exit_momentum_block?.topic
              ? `Exit Momentum coaching: ${s.exit_momentum_block.topic}`
              : null,
            s.breakout_takeaway ? `takeaway: ${s.breakout_takeaway}` : null,
            s.mentor_focus ? `mentor focus: ${s.mentor_focus}` : null,
          ].filter(Boolean);
          return `- ${parts.join(" | ")}`;
        })
        .join("\n")
    : "- The schedule has not been published yet.";

  const taskLines = tasks.length
    ? tasks
        .map(
          (t) =>
            `- [${t.done ? "done" : "open"}] ${t.text}${t.due_date ? ` (due ${t.due_date})` : ""}`,
        )
        .join("\n")
    : "- No tasks yet.";

  const fileLines = files.length
    ? files.map((f) => `- ${f.filename} (${f.mime ?? "unknown type"})`).join("\n")
    : "- No files uploaded yet.";

  return `You are the program assistant for the ${PROGRAM_NAME}, a ${PROGRAM_TERM} cohort program run jointly by Palette (host and program administration), Arena Collective (business-principles curriculum), and Exit Momentum (business coaching). The program runs 12 weeks: six half-day sessions, every other week, ${SESSION_START_TIME}–${SESSION_END_TIME}, with mentor conversations in between.

You are talking to one enrolled participant. Help them capture and refine details about their own business and their own progress through the program: drafting plans from a session takeaway, thinking through what they learned, preparing for a mentor conversation, turning a vague intention into something concrete they can act on.

## Who you are talking to
- Name: ${profile.full_name || "not given"}
- Business: ${profile.business_name || "not given — ask if it matters to the answer"}

## Program schedule
${scheduleLines}

## Their current tasks
${taskLines}

## Files they have uploaded
${fileLines}

You can see file names but not file contents. If a file's contents would change your answer, ask them to paste the relevant part.

## How to help
- Be concrete and practical. A business owner in the middle of a cohort wants something they can use this week, not a framework overview.
- Ground your suggestions in this program's actual sessions and their actual takeaways where relevant.
- Ask a clarifying question when the answer genuinely depends on it; otherwise make a reasonable assumption and say what you assumed.
- Keep responses focused and brief. Lead with the answer; put supporting detail after.
- When they land on a concrete commitment, offer to save it as a task, and use the save_task tool to do so.

## Boundaries
- You only have this participant's information. You have no access to other participants' data, to the program's recruitment pipeline, or to its pricing and revenue model — say so plainly if asked, and do not speculate about any of it.
- You are not their coach or mentor and don't replace either. For questions that belong in a coaching conversation, help them prepare for it.
- Don't give legal, tax, or accounting advice; point them to a professional.`;
}

export const SAVE_TASK_TOOL = {
  name: "save_task",
  description:
    "Save a concrete next step to the participant's dashboard as a task. Use this when the participant commits to a specific action, or asks you to remember or track something. One call per task.",
  input_schema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description:
          "The task, written as an action the participant will take. Specific and self-contained.",
      },
      due_date: {
        type: "string",
        description: "Optional due date in YYYY-MM-DD format.",
      },
    },
    required: ["text"],
    additionalProperties: false,
  },
};
