import { parseCSV } from "@/lib/csv";
import { PIPELINE_STAGES, type PipelineStage } from "./config";
import type { Lead } from "./types";

/**
 * Suggested fit score against the ICP: 2–3+ years in business, hitting a
 * growth ceiling, has employees, ready to scale. It's a starting point for
 * the outreach owner, not a verdict — the field stays editable.
 */
export function suggestFitScore(lead: Partial<Lead>): number {
  let score = 0;

  const years = lead.years_in_business ?? 0;
  if (years >= 3) score += 35;
  else if (years === 2) score += 25;
  else if (years === 1) score += 10;

  const employees = lead.employees ?? 0;
  if (employees >= 5) score += 30;
  else if (employees >= 1) score += 20;

  if (lead.revenue_band?.trim()) score += 15;
  if (lead.industry?.trim()) score += 10;
  if (lead.referred_by?.trim()) score += 10;

  return Math.min(100, score);
}

export function fitBand(score: number | null): {
  label: string;
  color: string;
} {
  if (score === null) return { label: "Unscored", color: "var(--muted)" };
  if (score >= 70) return { label: "Strong fit", color: "var(--green)" };
  if (score >= 45) return { label: "Possible", color: "var(--amber)" };
  return { label: "Weak fit", color: "var(--red)" };
}

export const LEAD_CSV_COLUMNS = [
  "name",
  "business",
  "industry",
  "years_in_business",
  "revenue_band",
  "employees",
  "source",
  "referred_by",
  "stage",
  "last_touch",
  "next_follow_up",
  "fit_score",
  "notes",
] as const;

export function leadsToCSV(leads: Lead[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = LEAD_CSV_COLUMNS.join(",");
  const rows = leads.map((lead) =>
    LEAD_CSV_COLUMNS.map((c) => escape(lead[c as keyof Lead])).join(","),
  );
  return [header, ...rows].join("\n");
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Header aliases so a spreadsheet exported from anywhere still imports. */
const HEADER_ALIASES: Record<string, (typeof LEAD_CSV_COLUMNS)[number]> = {
  name: "name",
  fullname: "name",
  contact: "name",
  business: "business",
  company: "business",
  businessname: "business",
  industry: "industry",
  yearsinbusiness: "years_in_business",
  years: "years_in_business",
  revenueband: "revenue_band",
  revenue: "revenue_band",
  employees: "employees",
  headcount: "employees",
  source: "source",
  referredby: "referred_by",
  referral: "referred_by",
  stage: "stage",
  pipelinestage: "stage",
  lasttouch: "last_touch",
  nextfollowup: "next_follow_up",
  fitscore: "fit_score",
  notes: "notes",
};

function canonStage(value: string): PipelineStage {
  const n = value.toLowerCase().replace(/[^a-z]/g, "");
  const match = PIPELINE_STAGES.find(
    (s) => s.replace(/[^a-z]/g, "") === n || s.startsWith(n),
  );
  return match ?? "prospect";
}

function toInt(value: string): number | null {
  const n = Number.parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function toDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export type ParsedLeadImport = {
  rows: Partial<Lead>[];
  error?: string;
};

export function parseLeadsCSV(text: string): ParsedLeadImport {
  const rows = parseCSV(text);
  if (rows.length === 0) return { rows: [], error: "That CSV appears to be empty." };

  const header = rows[0].map(normalizeHeader);
  const columnAt = header.map((h) => HEADER_ALIASES[h] ?? null);

  if (!columnAt.includes("name")) {
    return {
      rows: [],
      error:
        "Could not find a Name column. Expected a header row containing at least 'name'.",
    };
  }

  const out: Partial<Lead>[] = [];

  for (const row of rows.slice(1)) {
    const lead: Partial<Lead> = {};

    row.forEach((cell, i) => {
      const column = columnAt[i];
      if (!column) return;
      const value = cell.trim();
      if (!value) return;

      switch (column) {
        case "years_in_business":
        case "employees":
        case "fit_score":
          lead[column] = toInt(value);
          break;
        case "last_touch":
        case "next_follow_up":
          lead[column] = toDate(value);
          break;
        case "stage":
          lead.stage = canonStage(value);
          break;
        default:
          lead[column] = value;
      }
    });

    if (lead.name?.trim()) {
      if (lead.fit_score === undefined || lead.fit_score === null) {
        lead.fit_score = suggestFitScore(lead);
      }
      out.push(lead);
    }
  }

  if (out.length === 0) {
    return { rows: [], error: "No rows with a name were found in that CSV." };
  }

  return { rows: out };
}
