import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/bmc/auth";
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_BYTES,
  formatBytes,
} from "@/lib/bmc/files";
import type { StoredFile } from "@/lib/bmc/types";
import {
  buttonClass,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
} from "@/components/bmc/ui";
import { deleteFile, uploadFile } from "./actions";

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const me = await requireProfile();
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("bmc_files")
    .select("id, owner_id, storage_path, filename, mime, size, scope, created_at")
    .eq("owner_id", me.id)
    .order("created_at", { ascending: false });

  const files = (data ?? []) as StoredFile[];
  const totalBytes = files.reduce((sum, f) => sum + Number(f.size ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Private to you"
        title="Files"
        hint="Financials, org charts, plans — anything about your business you want to work from during the program. Only you and the program administrator can see these."
      />

      {error && (
        <p className="mb-4 text-[13px] rounded-md px-3 py-2 border border-[var(--red)] text-[var(--red)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)]">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 text-[13px] rounded-md px-3 py-2 border border-[var(--teal)] text-[var(--teal)] bg-[var(--teal-lt)]">
          {message}
        </p>
      )}

      <Card className="mb-5">
        <Eyebrow className="mb-2">Upload a document</Eyebrow>
        <form action={uploadFile} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            required
            accept={ACCEPT_ATTRIBUTE}
            aria-label="File to upload"
            className="text-[13px] flex-1 min-w-[220px]"
          />
          <button type="submit" className={buttonClass("primary")}>
            Upload
          </button>
        </form>
        <p className="text-[12px] text-[var(--muted)] mt-2">
          PDF, Word, Excel, PowerPoint, CSV, text, and images. Up to{" "}
          {formatBytes(MAX_UPLOAD_BYTES)} per file.
        </p>
      </Card>

      <Card padded={files.length === 0}>
        {files.length === 0 ? (
          <EmptyState
            title="No files yet"
            hint="Upload your first document above. The Assistant can reference the files you've uploaded when it helps you plan."
          />
        ) : (
          <div className="p-5">
            <div className="flex items-baseline justify-between mb-3">
              <Eyebrow>Your documents</Eyebrow>
              <span className="mono text-[11px] text-[var(--muted)]">
                {files.length} file{files.length === 1 ? "" : "s"} ·{" "}
                {formatBytes(totalBytes)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] min-w-[600px]">
                <thead>
                  <tr className="border-b border-[var(--rule)] text-left">
                    {["File", "Type", "Size", "Uploaded", ""].map((h) => (
                      <th key={h} className="eyebrow font-medium py-2 pr-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-[var(--rule)] last:border-0"
                    >
                      <td className="py-2 pr-3">{f.filename}</td>
                      <td className="py-2 pr-3 mono text-[11px] text-[var(--muted)]">
                        {f.mime ?? "—"}
                      </td>
                      <td className="py-2 pr-3 mono text-[11px]">
                        {formatBytes(Number(f.size ?? 0))}
                      </td>
                      <td className="py-2 pr-3 mono text-[11px] text-[var(--muted)]">
                        {f.created_at.slice(0, 10)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        <a
                          href={`/bmc/files/${f.id}/download`}
                          className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--gold)] hover:underline mr-3"
                        >
                          Download
                        </a>
                        <form action={deleteFile} className="inline no-print">
                          <input type="hidden" name="id" value={f.id} />
                          <button
                            type="submit"
                            className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--red)]"
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
          </div>
        )}
      </Card>
    </>
  );
}
