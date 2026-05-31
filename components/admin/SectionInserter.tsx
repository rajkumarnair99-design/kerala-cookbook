"use client";

import { Plus } from "lucide-react";

/**
 * A "+ between sections" affordance, mirroring StepInserter. One renders above
 * the first section, one below the last, and one in every gap — N+1 for N
 * sections. Clicking inserts a new section at that position.
 *
 * Deliberately NOT registered with dnd-kit's SortableContext, so section
 * drag-and-drop ignores it. Always faintly visible (works on touch) and
 * brightens on hover / keyboard focus. Sections have no timeline rail, so
 * (unlike StepInserter) there is no connecting line — just the centred "+".
 */
export default function SectionInserter({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group relative flex h-7 items-center justify-center">
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule opacity-0 transition-opacity group-hover:opacity-70 group-focus-within:opacity-70"
      />
      <button
        type="button"
        onClick={onInsert}
        aria-label="Add a section here"
        className="relative inline-flex h-6 w-6 items-center justify-center rounded-lg border border-rule bg-background text-ink-muted opacity-40 transition hover:border-accent hover:text-accent-ink hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
