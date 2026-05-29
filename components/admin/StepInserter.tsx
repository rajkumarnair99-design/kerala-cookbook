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
 * Layout mirrors StepCard: a left rail column (same widths) so the timeline
 * line stays continuous through the gap, then the "+" in the card column.
 * `connected` draws the rail line (true for inserters BETWEEN two steps,
 * false for the ones above the first / below the last badge).
 *
 * Always faintly visible (so it works on touch, where there's no hover) and
 * brightens on hover or keyboard focus.
 */
export default function StepInserter({
  onInsert,
  connected,
}: {
  onInsert: () => void;
  connected: boolean;
}) {
  return (
    <div className="group flex gap-3">
      {/* Rail — mirrors StepCard's rail (grip w-4 + gap-1.5 + badge col w-9)
          so the connecting line lands on the same x as the badges above and
          below it. */}
      <div className="flex shrink-0 items-stretch gap-1.5">
        <div className="w-4" />
        <div className="relative w-9">
          {connected && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-rule"
            />
          )}
        </div>
      </div>

      {/* "+" affordance, centered in the card column with a hover hairline. */}
      <div className="relative flex h-7 flex-1 items-center justify-center">
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
    </div>
  );
}
