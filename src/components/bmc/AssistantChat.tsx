"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/bmc/types";
import { buttonClass } from "@/components/bmc/ui";

type Bubble = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Help me draft a 90-day plan from my latest session takeaway.",
  "What should I bring to my next mentor conversation?",
  "Turn what I just described into concrete next steps.",
];

export function AssistantChat({ initial }: { initial: ChatMessage[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Bubble[]>(
    initial.map((m) => ({ id: m.id, role: m.role, content: m.content })),
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInput("");
    setStreaming(true);

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/bmc/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.text();
        throw new Error(detail || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }

      // The assistant may have saved a task; refresh so the dashboard count and
      // any server-rendered state stay in step.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] min-h-[420px]">
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--muted)]">
              Ask about your business or your progress through the program. The
              assistant knows the schedule, your tasks, and the files you&apos;ve
              uploaded.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-[13px] border border-[var(--rule)] rounded-md px-3 py-2 hover:border-[var(--gold)] hover:text-[var(--gold)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] rounded-[10px] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "bg-[var(--white)] border border-[var(--rule)]"
              }`}
            >
              {m.content ||
                (streaming ? (
                  <span className="mono text-[12px] text-[var(--muted)]">
                    thinking…
                  </span>
                ) : null)}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="mt-3 text-[13px] rounded-md px-3 py-2 border border-[var(--red)] text-[var(--red)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]">
          {error}
        </p>
      )}

      <form
        ref={formRef}
        className="mt-4 flex items-end gap-2 border-t border-[var(--rule)] pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="Ask about your business or the program…"
          aria-label="Message the assistant"
          disabled={streaming}
          className="flex-1 resize-y border border-[var(--rule)] rounded-md px-3 py-2 text-[14px] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className={buttonClass("primary")}
        >
          {streaming ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
