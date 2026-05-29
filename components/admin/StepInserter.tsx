"use client";

import { Plus } from "lucide-react";

/**
 * A "+ between steps" affordance. One renders above the first step, one
 * below the last, and one in every gap — N+1 for N steps. Clicking inserts
 * a blank step at this position.
 *
 * It is deliberately NOT registered with dnd-kit's useSortable: these sit
 * as static layout between the sortable step nodes, so drag-and-drop ignores
 * them entirely.
 *
 * Always faintly visible (so it works on touch, where there's no hover) and
 * brightens on hover or keyboard focus.
 */
export default function StepInserter({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group relative flex h-7 items-center justify-center">
      {/* Hairline that runs the full width, revealed on hover/focus. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule opacity-0 transition-opacity group-hover:opacity-70 group-focus-within:opacity-70"
      />
      <button
        type="button"
        onClick={onInsert}
        aria-label="Add a step here"
        className="relative inline-flex h-6 w-6 items-center justify-center rounded-lg border border-rule bg-background text-ink-muted opacity-40 transition hover:border-accent hover:text-accent-ink hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
