export type Severity = "success" | "warning" | "danger" | "neutral";

/** Semantic color tokens for "at a glance, is this bad?" surfaces (Results, Status). */
export const SEVERITY_TEXT: Record<Severity, string> = {
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
  neutral: "text-neutral-500",
};

export const SEVERITY_TILE: Record<Severity, string> = {
  success: "text-emerald-600 border-emerald-300",
  warning: "text-amber-600 border-amber-300",
  danger: "text-red-600 border-red-300",
  neutral: "text-neutral-500 border-neutral-300",
};

export const SEVERITY_BANNER: Record<Severity, string> = {
  success: "bg-emerald-50 border-emerald-300 text-emerald-800",
  warning: "bg-amber-50 border-amber-300 text-amber-800",
  danger: "bg-red-50 border-red-300 text-red-800",
  neutral: "bg-neutral-50 border-neutral-300 text-neutral-600",
};

export const SEVERITY_DOT: Record<Severity, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-neutral-400",
};

/** Solid-color toast pills (GameNav) — saturated, unlike the pastel SEVERITY_BANNER. */
export const TOAST_KIND: Record<"success" | "error", { bg: string; icon: string }> = {
  success: { bg: "bg-emerald-600", icon: "✓" },
  error: { bg: "bg-red-600", icon: "✕" },
};

/** Type scale for KPI-style numerals vs. body/label text. */
export const TYPE = {
  kpiLg: "text-4xl font-extrabold tabular-nums",
  kpi: "text-3xl font-extrabold tabular-nums",
  kpiSm: "text-2xl font-bold tabular-nums",
  label: "text-[11px] font-semibold uppercase tracking-wide text-neutral-400",
};
