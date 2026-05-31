"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import RowOverflowMenu from "./RowOverflowMenu";

/**
 * One recipe in the admin list — a sortable row (within its category only).
 *
 * Layout: drag grip (the sole drag activator) · a navigating Link covering the
 * thumbnail, title, meta, and the pencil edit-cue · the "…" actions menu.
 * The grip and the menu sit OUTSIDE the Link so they don't navigate; the rest
 * of the row opens the editor.
 */
export default function RecipeRow({
  recipe,
  categories,
  onMove,
}: {
  recipe: RecipeSummary;
  /** All live categories (with current counts) — the "…" menu lists the
   *  others as move targets. */
  categories: AdminCategory[];
  onMove: (recipeSlug: string, targetCategorySlug: string) => void;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `recipe:${recipe.slug}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const meta = [
    recipe.author ?? "no author yet",
    recipe.tags.length > 0 ? recipe.tags.slice(0, 2).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1"
    >
      {/* Drag grip — the only drag activator. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Drag to reorder ${recipe.title}`}
        className="flex shrink-0 cursor-grab touch-none items-center text-ink-muted hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      {/* Main click target → editor. */}
      <Link
        href={`/admin/recipes/${recipe.slug}/edit`}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-chiclet px-2 py-1.5 transition-colors hover:bg-soft"
      >
        {recipe.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.heroImageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-chiclet border border-rule object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-chiclet border border-rule bg-soft text-ink-muted">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">
            {recipe.title}
          </span>
          <span className="block truncate text-xs text-ink-muted">{meta}</span>
        </span>

        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chiclet border border-rule text-ink-soft transition-colors group-hover:border-accent group-hover:text-accent-ink"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </span>
      </Link>

      {/* "…" actions menu (move to category). */}
      <RowOverflowMenu
        recipeTitle={recipe.title}
        currentCategorySlug={recipe.categorySlug}
        categories={categories}
        onMove={(targetSlug) => onMove(recipe.slug, targetSlug)}
      />
    </div>
  );
}
