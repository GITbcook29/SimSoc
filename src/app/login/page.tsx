import { signIn, signUp } from "./actions";
import { PlayerJoin } from "./PlayerJoin";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="font-mono tracking-[2px] font-bold text-[15px]">
            ◉ SIM<span className="text-[var(--accent)]">SOC</span>
          </div>
          <h1 className="text-xl font-semibold">SimSoc Coordinator Cockpit</h1>
          <p className="text-sm text-neutral-500">Sign in to access your games.</p>
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/10 border border-red-500/45 rounded px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/40 rounded px-3 py-2">
            {message}
          </p>
        )}

        <form className="space-y-3" action={signIn}>
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full bg-[var(--accent)] text-[var(--accent-ink)] rounded px-3 py-2 text-sm font-semibold hover:brightness-110"
          >
            Sign in
          </button>
        </form>

        <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[1.5px] text-neutral-400">
          <div className="h-px flex-1 bg-[var(--line-2)]" />
          new here
          <div className="h-px flex-1 bg-[var(--line-2)]" />
        </div>

        <form className="space-y-3" action={signUp}>
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Choose a password"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full border border-[var(--line)] rounded px-3 py-2 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Create account
          </button>
        </form>

        <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[1.5px] text-neutral-400">
          <div className="h-px flex-1 bg-[var(--line-2)]" />
          playing in a game
          <div className="h-px flex-1 bg-[var(--line-2)]" />
        </div>

        <PlayerJoin />
        <p className="text-center text-[11px] text-neutral-500">
          Enter the game code from your coordinator to see the live status board. No account needed.
        </p>
      </div>
    </div>
  );
}
