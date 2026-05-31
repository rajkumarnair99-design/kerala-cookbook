"use client";

import { Plus } from "lucide-react";

/**
 * The "+ Add category" chiclet, top-right of the admin list. Visible but inert
 * in 5a — clicking it just surfaces a placeholder toast. The real add flow
 * (inline name input → addCategory action) is wired in a later sub-step.
 */
export default function AddCategoryControl({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-2 rounded-chiclet border border-rule bg-card px-3.5 py-2 text-sm font-medium text-accent-ink transition-colors hover:border-accent"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Add category
    </button>
  );
}
