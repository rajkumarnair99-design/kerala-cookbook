"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import RecipeRow from "./RecipeRow";

/**
 * One category on the admin list: a serif-titled header (categories are
 * first-class structural units, not subordinate labels) with its controls,
 * and a collapsible body of recipe rows in their stored order.
 *
 * In 5a everything except the collapse chevron is inert:
 *  - grip (reorder) — visible, drag wired in 5b
 *  - pencil (rename) — visible, wired in 5c
 *  - trash (delete) — greyed/disabled when the category has recipes; visible
 *    and enabled-looking only when empty, but still inert until 5c
 *  - chevron — FUNCTIONAL: toggles this section's local collapse state
 */
export default function CategorySection({
  category,
  recipes,
}: {
  category: AdminCategory;
  recipes: RecipeSummary[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isEmpty = category.count === 0;

  return (
    <section className="rounded-2xl border border-rule bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span aria-hidden className="flex shrink-0 cursor-grab text-ink-muted">
          <GripVertical className="h-4 w-4" aria-hidden />
        </span>

        <h2 className="font-serif text-xl leading-tight text-ink">
          {category.name}
        </h2>
        <span className="text-xs text-ink-muted">
          {category.count} {category.count === 1 ? "recipe" : "recipes"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Rename (inert in 5a) */}
          <button
            type="button"
            aria-label={`Rename ${category.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-chiclet border border-rule bg-card text-ink-soft transition-colors hover:border-accent hover:text-accent-ink"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>

          {/* Delete — greyed/disabled while the category has recipes */}
          <button
            type="button"
            disabled={!isEmpty}
            aria-label={`Delete ${category.name}`}
            title={
              isEmpty
                ? "Delete category"
                : "Move or recategorize the recipes before deleting"
            }
            className={
              "flex h-8 w-8 items-center justify-center rounded-chiclet border border-rule bg-card transition-colors " +
              (isEmpty
                ? "text-ink-soft hover:border-accent hover:text-accent-ink"
                : "cursor-not-allowed text-ink-muted opacity-40")
            }
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>

          {/* Collapse / expand — the one functional control in 5a */}
          <button
            type="button"
            aria-label={collapsed ? "Expand category" : "Collapse category"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-8 w-8 items-center justify-center text-ink-muted transition-colors hover:text-ink"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-rule px-2 pb-2 pt-1">
          {recipes.length === 0 ? (
            <p className="px-2 py-5 text-center text-sm text-ink-soft">
              No recipes in this category yet.
            </p>
          ) : (
            <div className="divide-y divide-rule/50">
              {recipes.map((recipe) => (
                <RecipeRow key={recipe.slug} recipe={recipe} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
