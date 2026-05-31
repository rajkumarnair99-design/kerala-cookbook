"use client";

import { useEffect, useRef } from "react";

/**
 * A small themed confirmation modal. Used for destructive actions like
 * deleting a non-empty section. Matches the editor's warm palette rather
 * than the browser's native window.confirm.
 *
 * Controlled: render it with `open` true to show. Esc or the overlay
 * cancels; the confirm button runs `onConfirm`.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  initialFocus = "confirm",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Which button gets focus on open. Use "cancel" for destructive dialogs so
   *  a stray Enter cancels rather than confirms. Defaults to "confirm". */
  initialFocus?: "confirm" | "cancel";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // Focus the chosen button on open; close on Esc; trap Tab within the two
  // buttons so focus can't wander to the page behind the modal.
  useEffect(() => {
    if (!open) return;
    (initialFocus === "cancel" ? cancelRef : confirmRef).current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key === "Tab") {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, initialFocus]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay — click to cancel. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-ink/30 backdrop-blur-[1px]"
      />
      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-rule bg-card p-6 shadow-xl">
        <h2 className="font-serif text-xl text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
