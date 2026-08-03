"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "../game-context";
import type { Rule } from "@/lib/types";

// Per-game house rules the coordinator keeps here and players read on the status
// link. Reference text only — nothing here touches the indicator/session math.
export function ParticipantRules() {
  const { rules, addRule, updateRule, deleteRule } = useGame();
  const [newText, setNewText] = useState("");

  function handleAdd() {
    if (!newText.trim()) return;
    addRule(newText);
    setNewText("");
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">Participant rules</h2>

      {rules.length === 0 ? (
        <p className="text-neutral-500">No participant rules added yet.</p>
      ) : (
        <ol className="list-decimal ml-4 space-y-0.5 mb-2">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onSave={updateRule} onDelete={deleteRule} />
          ))}
        </ol>
      )}

      <div className="flex gap-2 mt-3 flex-wrap">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a rule for participants"
          className="flex-1 min-w-[160px] border rounded px-2 py-1.5 text-sm"
        />
        <button
          onClick={handleAdd}
          className="bg-[var(--accent)] text-[var(--accent-ink)] font-semibold hover:brightness-110 rounded px-3 py-1.5 text-sm"
        >
          Add rule
        </button>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  onSave,
  onDelete,
}: {
  rule: Rule;
  onSave: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rule.text);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape must cancel without saving, but it also blurs the input — this flag lets
  // the blur handler know the edit was already abandoned.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setDraft(rule.text);
    cancelledRef.current = false;
    setEditing(true);
  }

  function commit() {
    if (cancelledRef.current) return;
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== rule.text) onSave(rule.id, trimmed);
  }

  function cancel() {
    cancelledRef.current = true;
    setEditing(false);
    setDraft(rule.text);
  }

  return (
    <li className="group text-neutral-500">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") cancel();
            }}
            className="flex-1 min-w-0 border rounded px-2 py-1 text-xs"
          />
        ) : (
          <>
            <button
              onClick={startEditing}
              title="Edit rule"
              className="flex-1 min-w-0 text-left hover:text-neutral-300 cursor-text"
            >
              {rule.text}
            </button>
            <span
              aria-hidden
              className="opacity-0 group-hover:opacity-100 text-neutral-500 text-[10px] transition"
            >
              ✎
            </span>
          </>
        )}
        <button
          onClick={() => onDelete(rule.id)}
          title="Delete rule"
          aria-label={`Delete rule: ${rule.text}`}
          className="shrink-0 text-neutral-400 hover:text-red-500 px-1"
        >
          ×
        </button>
      </div>
    </li>
  );
}
