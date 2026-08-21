import { createClient } from "@/lib/bmc/supabase/server";
import { requireAdmin } from "@/lib/bmc/auth";
import { ORGS, ORG_LABEL, ROLES } from "@/lib/bmc/config";
import type { Profile, TeamMember } from "@/lib/bmc/types";
import {
  Badge,
  buttonClass,
  Card,
  CardHeader,
  EmptyState,
  Eyebrow,
  OrgBadge,
  PageHeader,
} from "@/components/bmc/ui";
import { EditableSelect, EditableText } from "@/components/bmc/EditableField";
import {
  addRosterMember,
  removeRosterMember,
  setProfileField,
  setProfileOrg,
  setProfileRole,
  setRosterField,
  setRosterOrg,
} from "./actions";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r }));
const ORG_OPTIONS = [
  { value: "", label: "— org —" },
  ...ORGS.filter((o) => o !== "shared").map((o) => ({
    value: o,
    label: ORG_LABEL[o],
  })),
];

export default async function AdminPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const [{ data: profileData }, { data: rosterData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, org, role, business_name, avatar_url")
      .order("role")
      .order("full_name"),
    supabase
      .from("team_roster")
      .select("id, full_name, org, role_title, email, profile_id, active, sort_order")
      .order("sort_order"),
  ]);

  const profiles = (profileData ?? []) as Profile[];
  const roster = (rosterData ?? []) as TeamMember[];
  const participants = profiles.filter((p) => p.role === "participant");
  const team = profiles.filter((p) => p.role !== "participant");

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="People & Access"
        hint="Accounts start as participants. Promote build-team members to staff, or to admin for user management and full access."
      />

      <Card className="mb-5">
        <CardHeader
          eyebrow="Accounts"
          title="Build team"
          hint="Admins see everything including this page. Staff see all build-team tabs but not participant files or chats."
        />
        {team.length === 0 ? (
          <EmptyState title="No staff or admin accounts yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] min-w-[720px]">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  {["Name", "Email", "Org", "Role", ""].map((h) => (
                    <th key={h} className="eyebrow font-medium py-2 pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--rule)] last:border-0">
                    <td className="py-2 pr-3 w-[220px]">
                      <EditableText
                        action={setProfileField.bind(null, p.id, "full_name")}
                        defaultValue={p.full_name}
                        ariaLabel="Full name"
                      />
                    </td>
                    <td className="py-2 pr-3 mono text-[12px] text-[var(--muted)]">
                      {p.email}
                    </td>
                    <td className="py-2 pr-3 w-[170px]">
                      <EditableSelect
                        action={setProfileOrg.bind(null, p.id)}
                        defaultValue={p.org ?? ""}
                        options={ORG_OPTIONS}
                        ariaLabel="Org"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[140px]">
                      <EditableSelect
                        action={setProfileRole.bind(null, p.id)}
                        defaultValue={p.role}
                        options={ROLE_OPTIONS}
                        ariaLabel="Role"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      {p.id === me.id && <Badge color="var(--gold)">You</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader
          eyebrow="Accounts"
          title="Participants"
          hint="Enrolled business owners. Their files and assistant chats are private to them and to admins."
        />
        {participants.length === 0 ? (
          <EmptyState
            title="No participants yet"
            hint="Convert a committed lead on the Leads tab to send an invite."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] min-w-[720px]">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  {["Name", "Business", "Email", "Role"].map((h) => (
                    <th key={h} className="eyebrow font-medium py-2 pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--rule)] last:border-0">
                    <td className="py-2 pr-3 w-[220px]">
                      <EditableText
                        action={setProfileField.bind(null, p.id, "full_name")}
                        defaultValue={p.full_name}
                        ariaLabel="Participant name"
                      />
                    </td>
                    <td className="py-2 pr-3 w-[220px]">
                      <EditableText
                        action={setProfileField.bind(null, p.id, "business_name")}
                        defaultValue={p.business_name}
                        ariaLabel="Business name"
                      />
                    </td>
                    <td className="py-2 pr-3 mono text-[12px] text-[var(--muted)]">
                      {p.email}
                    </td>
                    <td className="py-2 pr-3 w-[140px]">
                      <EditableSelect
                        action={setProfileRole.bind(null, p.id)}
                        defaultValue={p.role}
                        options={ROLE_OPTIONS}
                        ariaLabel="Role"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          eyebrow="Reference"
          title="Build team roster"
          hint="Names that appear in owner pickers and meeting attendee lists, whether or not that person has an account yet."
        />
        <div className="space-y-2">
          {roster.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[160px]">
                <EditableText
                  action={setRosterField.bind(null, m.id, "full_name")}
                  defaultValue={m.full_name}
                  ariaLabel="Roster name"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <EditableText
                  action={setRosterField.bind(null, m.id, "role_title")}
                  defaultValue={m.role_title}
                  placeholder="Role"
                  ariaLabel="Roster role title"
                />
              </div>
              <div className="w-[170px]">
                <EditableSelect
                  action={setRosterOrg.bind(null, m.id)}
                  defaultValue={m.org ?? ""}
                  options={ORG_OPTIONS}
                  ariaLabel="Roster org"
                />
              </div>
              <OrgBadge org={m.org} />
              <form action={removeRosterMember} className="no-print">
                <input type="hidden" name="id" value={m.id} />
                <button
                  type="submit"
                  aria-label={`Remove ${m.full_name} from the roster`}
                  className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>

        <form action={addRosterMember} className="flex flex-wrap gap-2 mt-4 no-print">
          <input
            name="full_name"
            required
            placeholder="Name"
            aria-label="New roster member name"
            className="field flex-1 min-w-[160px]"
          />
          <input
            name="role_title"
            placeholder="Role"
            aria-label="New roster member role"
            className="field flex-1 min-w-[160px]"
          />
          <button type="submit" className={buttonClass()}>
            Add to roster
          </button>
        </form>
      </Card>

      <Eyebrow className="mt-6">
        Promoting the first admin requires a SQL update — see the README.
      </Eyebrow>
    </>
  );
}
