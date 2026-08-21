import { createClient } from "@/lib/bmc/supabase/server";
import { requireTeam } from "@/lib/bmc/auth";
import { ORGS, ORG_COLOR, ORG_LABEL, type Org } from "@/lib/bmc/config";
import type { MatrixRow, TeamMember } from "@/lib/bmc/types";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
} from "@/components/bmc/ui";
import { EditableText, EditableTextarea } from "@/components/bmc/EditableField";
import { RaciCell } from "@/components/bmc/RaciCell";
import {
  addWorkstream,
  deleteWorkstream,
  renameWorkstream,
  setCellNotes,
  setCellOwner,
  setCellRaci,
} from "./actions";

type Workstream = {
  name: string;
  sort: number;
  cells: Partial<Record<Org, MatrixRow>>;
};

function group(rows: MatrixRow[]): Workstream[] {
  const map = new Map<string, Workstream>();

  for (const row of rows) {
    let ws = map.get(row.workstream);
    if (!ws) {
      ws = { name: row.workstream, sort: row.sort_order, cells: {} };
      map.set(row.workstream, ws);
    }
    ws.sort = Math.min(ws.sort, row.sort_order);
    ws.cells[row.org] = row;
  }

  return [...map.values()].sort(
    (a, b) => a.sort - b.sort || a.name.localeCompare(b.name),
  );
}

/** A workstream with nobody Accountable is the gap the team needs flagged. */
function hasAccountable(ws: Workstream): boolean {
  return Object.values(ws.cells).some((cell) => cell?.raci === "A");
}

export default async function MatrixPage() {
  await requireTeam();
  const supabase = await createClient();

  const [{ data: rowData }, { data: rosterData }] = await Promise.all([
    supabase
      .from("responsibility_matrix")
      .select("id, workstream, org, owner_profile_id, owner_name, raci, notes, sort_order")
      .order("sort_order"),
    supabase
      .from("team_roster")
      .select("id, full_name, org, role_title, email, profile_id, active, sort_order")
      .eq("active", true)
      .order("sort_order"),
  ]);

  const rows = (rowData ?? []) as MatrixRow[];
  const roster = (rosterData ?? []) as TeamMember[];
  const rosterNames = roster.map((m) => m.full_name);
  const workstreams = group(rows);
  const gaps = workstreams.filter((ws) => !hasAccountable(ws));

  return (
    <>
      <PageHeader
        eyebrow="Cross-org ownership"
        title="Responsibility Matrix"
        hint="Who owns what across Palette, Arena, and Exit Momentum. Click a letter to cycle Responsible → Accountable → Consulted → Informed, then name the person who holds it."
      />

      {gaps.length > 0 && (
        <div className="mb-5 rounded-[10px] border border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] px-4 py-3">
          <Eyebrow className="mb-1">Gaps</Eyebrow>
          <p className="text-[13px]">
            {gaps.length} workstream{gaps.length === 1 ? " has" : "s have"} no
            Accountable owner:{" "}
            <span className="font-medium">
              {gaps.map((g) => g.name).join(", ")}
            </span>
          </p>
        </div>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] min-w-[900px]">
            <thead>
              <tr className="border-b border-[var(--rule)]">
                <th className="eyebrow font-medium text-left p-3 w-[220px]">
                  Workstream
                </th>
                {ORGS.map((org) => (
                  <th
                    key={org}
                    className="eyebrow font-medium text-left p-3"
                    style={{ color: ORG_COLOR[org] }}
                  >
                    {ORG_LABEL[org]}
                  </th>
                ))}
                <th className="eyebrow font-medium text-right p-3 w-[70px] no-print">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {workstreams.map((ws) => (
                <tr
                  key={ws.name}
                  className="border-b border-[var(--rule)] last:border-0 align-top"
                >
                  <td className="p-3">
                    <EditableText
                      action={renameWorkstream.bind(null, ws.name)}
                      defaultValue={ws.name}
                      ariaLabel={`Workstream name: ${ws.name}`}
                      className="font-medium"
                    />
                    {!hasAccountable(ws) && (
                      <div className="mt-1.5">
                        <Badge color="var(--amber)">No accountable owner</Badge>
                      </div>
                    )}
                  </td>

                  {ORGS.map((org) => (
                    <td key={org} className="p-3">
                      <RaciCell
                        org={org}
                        raci={ws.cells[org]?.raci ?? null}
                        ownerName={ws.cells[org]?.owner_name ?? null}
                        rosterNames={rosterNames}
                        setRaci={setCellRaci.bind(null, ws.name, org)}
                        setOwner={setCellOwner.bind(null, ws.name, org)}
                      />
                    </td>
                  ))}

                  <td className="p-3 text-right no-print">
                    <form action={deleteWorkstream}>
                      <input type="hidden" name="workstream" value={ws.name} />
                      <button
                        type="submit"
                        className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                        aria-label={`Delete workstream ${ws.name}`}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {workstreams.length === 0 && (
          <div className="p-5">
            <EmptyState
              title="No workstreams yet"
              hint="Run the seed migration, or add the first workstream below."
            />
          </div>
        )}
      </Card>

      <Card className="mt-5 no-print">
        <form action={addWorkstream} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Eyebrow className="mb-1.5">Add a workstream</Eyebrow>
            <input
              name="workstream"
              required
              placeholder="e.g. Alumni & Next Cohort"
              aria-label="New workstream name"
              className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-[14px]"
            />
          </div>
          <button type="submit" className={buttonClass("primary")}>
            Add workstream
          </button>
        </form>
      </Card>

      <details className="mt-5 group">
        <summary className="eyebrow cursor-pointer select-none py-2">
          Notes per assignment
        </summary>
        <div className="grid gap-4 mt-2 md:grid-cols-2">
          {workstreams.map((ws) => (
            <Card key={ws.name}>
              <Eyebrow className="mb-2">{ws.name}</Eyebrow>
              <div className="space-y-3">
                {ORGS.map((org) => (
                  <div key={org}>
                    <div
                      className="mono text-[9px] uppercase tracking-[0.12em] mb-1"
                      style={{ color: ORG_COLOR[org] }}
                    >
                      {ORG_LABEL[org]}
                    </div>
                    <EditableTextarea
                      action={setCellNotes.bind(null, ws.name, org)}
                      defaultValue={ws.cells[org]?.notes ?? ""}
                      rows={2}
                      placeholder="Scope, handoffs, dependencies…"
                      ariaLabel={`Notes for ${ws.name} — ${ORG_LABEL[org]}`}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </details>
    </>
  );
}
