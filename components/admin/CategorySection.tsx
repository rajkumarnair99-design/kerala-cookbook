"use client";

import { useState, type ReactNode } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import RecipeRow from "./RecipeRow";

/**
 * One category card on the admin list. The header carries the category drag
 * grip (passed in as `dragHandle`, since the sortable wiring lives in the
 * parent), a serif title, count, and the (still-inert in 5b) rename/delete
 * chiclets plus a functional collapse chevron. The body hosts a per-category
 * SortableContext so its recipes can be dragged to reorder within the
 * category. Cross-category moves happen via each row's "…" menu, not drag.
 *
 * `isDropTarget` is set while a *category* drag hovers this card (so it shows
 * the dashed terracotta drop treatment for the reorder).
 */
export default function CategorySection({
  category,
  recipes,
  categories,
  onMove,
  dragHandle,
  isDropTarget,
}: {
  category: AdminCategory;
  recipes: RecipeSummary[];
  categories: AdminCategory[];
  onMove: (recipeSlug: string, targetCategorySlug: string) => void;
  dragHandle: ReactNode;
  isDropTarget: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isEmpty = category.count === 0;

  return (
    <section
      className={
        "rounded-2xl border bg-card transition-colors " +
        (isDropTarget
          ? "border-rule outline outline-2 outline-dashed outline-accent-soft -outline-offset-2 bg-accent-soft/[0.09]"
          : "border-rule")
      }
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {dragHandle}

        <h2 className="font-serif text-xl leading-tight text-ink">
          {category.name}
        </h2>
        <span className="text-xs text-ink-muted">
          {category.count} {category.count === 1 ? "recipe" : "recipes"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={`Rename ${category.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-chiclet border border-rule bg-card text-ink-soft transition-colors hover:border-accent hover:text-accent-ink"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
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
            <SortableContext
              items={recipes.map((r) => `recipe:${r.slug}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-rule/50">
                {recipes.map((recipe) => (
                  <RecipeRow
                    key={recipe.slug}
                    recipe={recipe}
                    categories={categories}
                    onMove={onMove}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </section>
  );
}
