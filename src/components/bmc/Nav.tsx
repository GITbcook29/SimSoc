"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Program sections"
      className="no-print border-b border-[var(--rule)] bg-[var(--white)]"
    >
      <div className="mx-auto max-w-[1400px] px-5 flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`mono whitespace-nowrap text-[10px] uppercase tracking-[0.12em] px-3 py-3 border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[var(--gold)] text-[var(--ink)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Print button — client-only because it calls window.print(). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mono text-[9px] uppercase tracking-[0.12em] border border-[rgba(246,242,236,0.3)] text-[var(--paper)] rounded px-2.5 py-1.5 hover:border-[var(--gold)] hover:text-[var(--gold)]"
    >
      {label}
    </button>
  );
}
