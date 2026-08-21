"use client";

import type { ReactNode } from "react";

// Minimal reusable confirm modal — the app previously had no dialog/modal
// component and relied on window.confirm everywhere. Built for the
// close-session unmarked-participants guard; safe to reuse elsewhere.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2 id="confirm-dialog-title" className="text-sm font-semibold mb-2">
          {title}
        </h2>
        <div className="text-sm text-neutral-300 mb-4">{message}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="border rounded px-3 py-1.5 text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="bg-[var(--accent)] text-[var(--accent-ink)] font-semibold hover:brightness-110 rounded px-3 py-1.5 text-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
