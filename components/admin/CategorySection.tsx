"use client";

import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import RecipeRow from "./RecipeRow";

/**
 * One category card on the admin list. The header carries the category drag
 * grip (passed in as `dragHandle`), a serif title (click the pencil to rename
 * inline), the count, a delete chiclet (active only when the category is
 * empty), and a collapse chevron. The body hosts a per-category SortableContext
 * so its recipes can be dragged to reorder within the category; cross-category
 * moves happen via each row's "…" menu.
 */
export default function CategorySection({
  category,
  recipes,
  categories,
  onMove,
  onRename,
  onRequestDelete,
  dragHandle,
}: {
  category: AdminCategory;
  recipes: RecipeSummary[];
  categories: AdminCategory[];
  onMove: (recipeSlug: string, targetCategorySlug: string) => void;
  onRename: (slug: string, newName: string) => void;
  onRequestDelete: (category: AdminCategory) => void;
  dragHandle: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const skipBlur = useRef(false);
  const isEmpty = category.count === 0;

  function startRename() {
    setDraft(category.name);
    setRenaming(true);
  }

  // Commit happens only here (Enter blurs the input → this fires once). An
  // Escape sets skipBlur so the resulting blur reverts instead of committing.
  function commitRename() {
    const skip = skipBlur.current;
    skipBlur.current = false;
    setRenaming(false);
    if (skip) return;
    const name = draft.trim();
    if (name && name !== category.name) onRename(category.slug, name);
  }

  function onRenameKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      skipBlur.current = true;
      e.currentTarget.blur();
    }
  }

  return (
    <section className="rounded-2xl border border-rule bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {dragHandle}

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onRenameKey}
            onBlur={commitRename}
            aria-label={`Rename ${category.name}`}
            className="min-w-0 flex-1 rounded-lg border border-rule bg-inset px-2 py-1 font-serif text-xl text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <>
            <h2 className="min-w-0 truncate font-serif text-xl leading-tight text-ink">
              {category.name}
            </h2>
            <span className="shrink-0 text-xs text-ink-muted">
              {category.count} {category.count === 1 ? "recipe" : "recipes"}
            </span>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!renaming && (
            <button
              type="button"
              aria-label={`Rename ${category.name}`}
              onClick={startRename}
              className="flex h-8 w-8 items-center justify-center rounded-chiclet border border-rule bg-card text-ink-soft transition-colors hover:border-accent hover:text-accent-ink"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            disabled={!isEmpty}
            aria-label={`Delete ${category.name}`}
            onClick={isEmpty ? () => onRequestDelete(category) : undefined}
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
