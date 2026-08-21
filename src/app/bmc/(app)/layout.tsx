import { requireProfile } from "@/lib/bmc/auth";
import { LOCKUP, PROGRAM_SHORT_NAME, PROGRAM_TERM } from "@/lib/bmc/config";
import { Nav, PrintButton, type NavItem } from "@/components/bmc/Nav";
import { signOut } from "../login/actions";

const TEAM_NAV: NavItem[] = [
  { href: "/bmc/matrix", label: "Matrix" },
  { href: "/bmc/sessions", label: "Sessions" },
  { href: "/bmc/meeting", label: "Meeting" },
  { href: "/bmc/roadmap", label: "Roadmap" },
  { href: "/bmc/leads", label: "Leads" },
  { href: "/bmc/pricing", label: "Pricing" },
];

const ADMIN_NAV: NavItem[] = [{ href: "/bmc/admin", label: "People" }];

const PARTICIPANT_NAV: NavItem[] = [
  { href: "/bmc/dashboard", label: "My Dashboard" },
  { href: "/bmc/program", label: "Program" },
  { href: "/bmc/files", label: "Files" },
  { href: "/bmc/assistant", label: "Assistant" },
];

export default async function BmcAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  const items =
    profile.role === "participant"
      ? PARTICIPANT_NAV
      : profile.role === "admin"
        ? [...TEAM_NAV, ...ADMIN_NAV]
        : TEAM_NAV;

  return (
    <div className="flex-1 flex flex-col">
      <header className="no-print sticky top-0 z-30 bg-[var(--ink)] border-b-[3px] border-[var(--gold)]">
        <div className="mx-auto max-w-[1400px] px-5 h-14 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mono text-[11px] font-medium tracking-[0.16em] uppercase text-[var(--paper)]">
              {PROGRAM_SHORT_NAME}
              <span className="text-[var(--gold)]"> / </span>
              {PROGRAM_TERM}
            </div>
            <div className="mono text-[9px] tracking-[0.14em] uppercase text-[rgba(246,242,236,0.5)] truncate">
              {LOCKUP}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="mono text-[9px] uppercase tracking-[0.12em] text-[rgba(246,242,236,0.6)] hidden sm:inline">
              {profile.full_name || profile.email} · {profile.role}
            </span>
            <PrintButton />
            <form action={signOut}>
              <button
                type="submit"
                className="mono text-[9px] uppercase tracking-[0.12em] border border-[rgba(246,242,236,0.3)] text-[var(--paper)] rounded px-2.5 py-1.5 hover:border-[var(--gold)] hover:text-[var(--gold)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <Nav items={items} />

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-5 py-7">{children}</main>
    </div>
  );
}
