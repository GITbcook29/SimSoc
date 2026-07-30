import { redirect } from "next/navigation";
import { getProfile, landingFor } from "@/lib/bmc/auth";
import { LOCKUP, PROGRAM_NAME, PROGRAM_TERM } from "@/lib/bmc/config";
import { buttonClass, Card, Eyebrow } from "@/components/bmc/ui";
import { sendMagicLink, signInWithPassword, signUpWithPassword } from "./actions";

export default async function BmcLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const profile = await getProfile();
  if (profile) redirect(landingFor(profile.role));

  const { error, message } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-2">
          <Eyebrow>{LOCKUP}</Eyebrow>
          <h1 className="text-[26px] leading-tight">{PROGRAM_NAME}</h1>
          <p className="text-[13px] text-[var(--muted)]">{PROGRAM_TERM}</p>
        </div>

        {error && (
          <p className="text-[13px] rounded-md px-3 py-2 border border-[var(--red)] text-[var(--red)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]">
            {error}
          </p>
        )}
        {message && (
          <p className="text-[13px] rounded-md px-3 py-2 border border-[var(--teal)] text-[var(--teal)] bg-[var(--teal-lt)]">
            {message}
          </p>
        )}

        <Card>
          <form className="space-y-3" action={signInWithPassword}>
            <Eyebrow>Sign in</Eyebrow>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
            <button type="submit" className={`${buttonClass("primary")} w-full`}>
              Sign in
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--rule)]" />
            <span className="eyebrow">or email me a link</span>
            <span className="h-px flex-1 bg-[var(--rule)]" />
          </div>

          <form className="space-y-3" action={sendMagicLink}>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              aria-label="Email for magic link"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
            <button type="submit" className={`${buttonClass()} w-full`}>
              Send magic link
            </button>
          </form>
        </Card>

        <Card>
          <form className="space-y-3" action={signUpWithPassword}>
            <Eyebrow>Create an account</Eyebrow>
            <p className="text-[12px] text-[var(--muted)] -mt-1">
              New accounts start as participants. A program admin assigns staff
              and admin access.
            </p>
            <input
              name="full_name"
              type="text"
              required
              autoComplete="name"
              placeholder="Full name"
              aria-label="Full name"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              aria-label="Email for new account"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Choose a password"
              aria-label="New password"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
            <button type="submit" className={`${buttonClass()} w-full`}>
              Create account
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
