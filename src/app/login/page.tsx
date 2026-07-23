import { signIn, signUp } from "./actions";

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
          <h1 className="text-2xl font-semibold">SimSoc Coordinator Cockpit</h1>
          <p className="text-sm text-neutral-500">Sign in to access your games.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
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
            className="w-full bg-black text-white rounded px-3 py-2 text-sm font-medium"
          >
            Sign in
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <div className="h-px flex-1 bg-neutral-200" />
          new here
          <div className="h-px flex-1 bg-neutral-200" />
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
            className="w-full border border-black rounded px-3 py-2 text-sm font-medium"
          >
            Create account
          </button>
        </form>
      </div>
    </div>
  );
}
