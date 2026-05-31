"use client";

import { Plus } from "lucide-react";
import type { AdminCategory } from "@/types/recipe";

export type ViewMode = "byCategory" | "alphabetical";

/**
 * The /admin left rail (mirrors the editor's sidebar feel): a view-mode
 * toggle, the categories list (doubles as jump-nav in both modes), an inert
 * "+ Add category" at the bottom of the list, and the leaf wordmark pinned to
 * the very bottom.
 *
 * The categories list is fully interactive in BOTH modes — clicking one jumps
 * to its section (switching back to "By category" first when in Alphabetical).
 * Active category is marked by a 3px terracotta left-border only (calm).
 */
export default function AdminSidebar({
  categories,
  viewMode,
  onViewModeChange,
  activeSlug,
  onCategoryClick,
  onAddCategory,
}: {
  categories: AdminCategory[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeSlug: string | null;
  onCategoryClick: (slug: string) => void;
  onAddCategory: () => void;
}) {
  const modes: { id: ViewMode; label: string }[] = [
    { id: "byCategory", label: "By category" },
    { id: "alphabetical", label: "Alphabetical" },
  ];

  return (
    <aside className="flex w-[300px] flex-none flex-col overflow-y-auto border-r border-rule bg-card">
      <div className="flex flex-col gap-6 px-4 py-6">
        {/* View-mode toggle */}
        <div>
          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            View
          </div>
          <div className="flex gap-1 rounded-chiclet bg-[#efe7dd] p-1">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onViewModeChange(m.id)}
                aria-pressed={viewMode === m.id}
                className={
                  "flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors " +
                  (viewMode === m.id
                    ? "bg-card font-semibold text-accent-ink shadow-sm"
                    : "text-ink-soft hover:text-ink")
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories list (jump-nav) */}
        <div>
          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Categories
          </div>
          <nav className="flex flex-col">
            {categories.map((c) => {
              const active = c.slug === activeSlug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => onCategoryClick(c.slug)}
                  aria-current={active ? "true" : undefined}
                  className={
                    "flex items-center justify-between gap-2 border-l-[3px] py-2 pl-3 pr-2 text-left transition-colors " +
                    (active
                      ? "border-accent"
                      : "border-transparent hover:bg-soft")
                  }
                >
                  <span className="font-serif text-[15px] text-ink">
                    {c.name}
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {c.count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Inert in 5b; wired in 5c. */}
          <button
            type="button"
            onClick={onAddCategory}
            className="mt-3 inline-flex items-center gap-2 rounded-chiclet border border-rule bg-card px-3 py-2 text-sm font-medium text-accent-ink transition-colors hover:border-accent"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add category
          </button>
        </div>
      </div>

      {/* Leaf footer, pinned to the very bottom (matches the editor). */}
      <div className="mt-auto px-5 pb-8 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/leaf-illustration.png"
          alt=""
          aria-hidden
          className="mb-3 h-auto w-32 opacity-85"
        />
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          Family Recipe Collection
        </div>
        <div className="mt-0.5 font-serif text-sm text-ink-soft">
          Good Food at Home
        </div>
      </div>
    </aside>
  );
}
