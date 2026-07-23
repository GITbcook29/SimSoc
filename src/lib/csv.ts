import { REGIONS, type Participant, type Region } from "./types";

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function canonRegion(v: string): Region | null {
  const m = REGIONS.find((r) => r.toLowerCase() === v.trim().toLowerCase());
  return m ?? null;
}

export function parseRosterCSV(text: string): { rows: Partial<Participant>[]; error?: string } {
  const rows = parseCSV(text);
  if (!rows.length) return { rows: [], error: "CSV appears to be empty." };

  const hdr = rows[0].map(norm);
  const find = (...alts: string[]) => {
    for (const a of alts) {
      const i = hdr.findIndex((h) => h === a || h.includes(a));
      if (i > -1) return i;
    }
    return -1;
  };
  const ix = {
    name: find("name", "participant", "student"),
    region: find("region"),
    role: find("role", "group", "position"),
    age: find("age"),
    gender: find("gender", "sex"),
    job: find("realworldjob", "job", "occupation", "profession", "work"),
    team: find("teamcolor", "team", "color", "colour"),
  };
  if (ix.name < 0) return { rows: [], error: "Could not find a Name column in the CSV header row." };

  const get = (r: string[], k: keyof typeof ix) => (ix[k] > -1 ? String(r[ix[k]] || "").trim() : "");

  const out: Partial<Participant>[] = [];
  for (const r of rows.slice(1)) {
    const name = get(r, "name");
    if (!name) continue;
    const region = canonRegion(get(r, "region"));
    out.push({
      name,
      region,
      role: get(r, "role"),
      age: get(r, "age"),
      gender: get(r, "gender"),
      job: get(r, "job"),
      team: get(r, "team") || region || undefined,
    });
  }
  return { rows: out };
}

export function downloadCSVTemplate() {
  const csv =
    "Name,Region,Role,Age,Gender,Real World Job,Team Color\nJane Doe,Red,BASIN,34,F,Accountant,Red\nJohn Smith,Blue,,29,M,Teacher,Blue\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "simsoc_roster_template.csv";
  a.click();
}
