"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Players enter the short game code from their coordinator and are taken
// straight to the live status view. The /display route resolves either a code
// or the full share token, so no account or password is involved.
export function PlayerJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim();
        if (c) router.push(`/display/${encodeURIComponent(c)}`);
      }}
    >
      <input
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        placeholder="Game code"
        className="w-full border rounded px-3 py-2 text-sm font-mono uppercase tracking-[2px] text-center"
      />
      <button
        type="submit"
        className="w-full border border-[var(--line)] rounded px-3 py-2 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        View live status &rarr;
      </button>
    </form>
  );
}
