export const FILES_BUCKET = "participant-files";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Common business-document types plus images. */
export const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

export const ACCEPT_ATTRIBUTE =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp";

/**
 * Strip anything that could escape the owner's folder or confuse the storage
 * key. The owner's uuid is the first path segment and RLS compares against it,
 * so a filename must never introduce a slash or a `..`.
 */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim();
  return cleaned.slice(0, 120) || "file";
}

export function storageKey(ownerId: string, filename: string): string {
  return `${ownerId}/${crypto.randomUUID()}-${safeFilename(filename)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
