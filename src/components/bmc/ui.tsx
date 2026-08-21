import type { ReactNode } from "react";
import {
  ORG_COLOR,
  ORG_LABEL,
  ORG_TINT,
  STATUS_COLOR,
  STATUS_LABEL,
  type Org,
  type Status,
} from "@/lib/bmc/config";

/** Small uppercase DM Mono eyebrow used above sections and in table headers. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`card bg-[var(--white)] border border-[var(--rule)] rounded-[10px] ${
        padded ? "p-5" : ""
      } ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  eyebrow,
  title,
  hint,
  right,
}: {
  eyebrow?: ReactNode;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        <h2 className="text-lg leading-tight">{title}</h2>
        {hint && <p className="text-[13px] text-[var(--muted)] mt-1">{hint}</p>}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  hint,
  right,
}: {
  eyebrow?: ReactNode;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
        <h1 className="text-[26px] leading-tight">{title}</h1>
        {hint && (
          <p className="text-[13px] text-[var(--muted)] mt-1.5 max-w-2xl">{hint}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 no-print">{right}</div>}
    </header>
  );
}

/** Uppercase DM Mono pill. Used for org tags and statuses. */
export function Badge({
  children,
  color = "var(--muted)",
  tint,
  title,
}: {
  children: ReactNode;
  color?: string;
  tint?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="mono inline-flex items-center rounded-full px-2 py-[3px] text-[9px] font-medium uppercase tracking-[0.12em] whitespace-nowrap border"
      style={{
        color,
        borderColor: color,
        background: tint ?? "transparent",
      }}
    >
      {children}
    </span>
  );
}

export function OrgBadge({ org }: { org: Org | null | undefined }) {
  if (!org) return <Badge>Unassigned</Badge>;
  return (
    <Badge color={ORG_COLOR[org]} tint={ORG_TINT[org]}>
      {ORG_LABEL[org]}
    </Badge>
  );
}

/** green / amber / red / grey dot for on-track, at-risk, off-track, not-started. */
export function StatusDot({ status }: { status: Status }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ background: STATUS_COLOR[status] }}
    />
  );
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={status} />
      <span className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
        {STATUS_LABEL[status]}
      </span>
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4 border border-dashed border-[var(--rule)] rounded-[10px]">
      <p className="text-[15px]">{title}</p>
      {hint && (
        <p className="text-[13px] text-[var(--muted)] mt-1.5 max-w-md mx-auto">{hint}</p>
      )}
      {action && <div className="mt-4 flex justify-center no-print">{action}</div>}
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function buttonClass(variant: "primary" | "secondary" | "danger" = "secondary") {
  switch (variant) {
    case "primary":
      return `${BUTTON_BASE} bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--gold)] hover:text-[var(--ink)]`;
    case "danger":
      return `${BUTTON_BASE} border border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)] hover:text-white`;
    default:
      return `${BUTTON_BASE} border border-[var(--rule)] bg-[var(--white)] text-[var(--ink)] hover:border-[var(--gold)] hover:text-[var(--gold)]`;
  }
}

/** Horizontal meter — used for session build completeness and progress bars. */
export function Meter({
  value,
  max,
  color = "var(--teal)",
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        {label && <span className="eyebrow">{label}</span>}
        <span className="mono text-[11px] text-[var(--muted)]">{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-[var(--rule)] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function TableShell({
  head,
  children,
  className = "",
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto -mx-5 px-5 ${className}`}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--rule)] text-left">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th className={`eyebrow font-medium py-2 pr-3 align-bottom ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`py-2 pr-3 align-top ${className}`}>{children}</td>;
}
