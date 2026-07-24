export type Severity = "success" | "warning" | "danger" | "neutral";

/** Semantic color tokens for "at a glance, is this bad?" surfaces (Results, Status). */
export const SEVERITY_TEXT: Record<Severity, string> = {
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  neutral: "text-neutral-500",
};

export const SEVERITY_TILE: Record<Severity, string> = {
  success: "text-emerald-400 border-emerald-500/40",
  warning: "text-amber-400 border-amber-500/40",
  danger: "text-red-400 border-red-500/50",
  neutral: "text-neutral-500 border-neutral-300",
};

export const SEVERITY_BANNER: Record<Severity, string> = {
  success: "bg-emerald-500/10 border-emerald-500/40 text-emerald-200",
  warning: "bg-amber-500/10 border-amber-500/40 text-amber-100",
  danger: "bg-red-500/10 border-red-500/45 text-red-200",
  neutral: "bg-white/5 border-neutral-300 text-neutral-400",
};

export const SEVERITY_DOT: Record<Severity, string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
  neutral: "bg-neutral-400",
};

/** Solid-color toast pills (GameNav) — saturated, unlike the translucent SEVERITY_BANNER. */
export const TOAST_KIND: Record<"success" | "error", { bg: string; icon: string }> = {
  success: { bg: "bg-emerald-600", icon: "✓" },
  error: { bg: "bg-red-600", icon: "✕" },
};

/** Type scale for KPI-style numerals vs. body/label text. Numerics are set in the
    monospace face with tabular figures so columns align and changes are scannable. */
export const TYPE = {
  kpiLg: "text-4xl font-extrabold tabular-nums font-mono",
  kpi: "text-3xl font-extrabold tabular-nums font-mono",
  kpiSm: "text-2xl font-bold tabular-nums font-mono",
  label: "text-[11px] font-semibold uppercase tracking-wide text-neutral-400",
};
