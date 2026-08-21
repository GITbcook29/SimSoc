"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/bmc/supabase/server";
import { requireProfile } from "@/lib/bmc/auth";
import {
  ACCEPTED_MIME,
  FILES_BUCKET,
  MAX_UPLOAD_BYTES,
  formatBytes,
  storageKey,
} from "@/lib/bmc/files";

const PATH = "/bmc/files";

function backWith(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params).toString()}`);
}

export async function uploadFile(formData: FormData) {
  const me = await requireProfile();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    backWith({ error: "Choose a file to upload." });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    backWith({
      error: `That file is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    });
  }

  // Browsers occasionally send an empty type for less common extensions, so an
  // unknown type is allowed through rather than blocking a legitimate upload.
  if (file.type && !ACCEPTED_MIME.includes(file.type)) {
    backWith({
      error: `${file.type} isn't a supported file type. PDFs, Office documents, CSVs, and images are.`,
    });
  }

  const supabase = await createClient();
  const key = storageKey(me.id, file.name);

  const { error: uploadError } = await supabase.storage
    .from(FILES_BUCKET)
    .upload(key, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) backWith({ error: uploadError.message });

  const { error: rowError } = await supabase.from("files").insert({
    owner_id: me.id,
    storage_path: key,
    filename: file.name,
    mime: file.type || null,
    size: file.size,
    scope: "participant",
  });

  if (rowError) {
    // Don't leave an orphaned object behind if the metadata row fails.
    await supabase.storage.from(FILES_BUCKET).remove([key]);
    backWith({ error: rowError.message });
  }

  revalidatePath(PATH);
  backWith({ message: `Uploaded ${file.name}.` });
}

export async function deleteFile(formData: FormData) {
  const me = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("files")
    .select("id, storage_path, owner_id")
    .eq("id", id)
    .eq("owner_id", me.id)
    .maybeSingle();

  if (!row) backWith({ error: "That file isn't yours to delete." });

  await supabase.storage.from(FILES_BUCKET).remove([row.storage_path]);
  await supabase.from("files").delete().eq("id", id).eq("owner_id", me.id);

  revalidatePath(PATH);
  backWith({ message: "File deleted." });
}
