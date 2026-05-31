"use client";

import Link from "next/link";
import { GripVertical, Pencil } from "lucide-react";
import type { RecipeSummary } from "@/types/recipe";

/**
 * One recipe in the admin list. The WHOLE row is a link to the editor;
 * clicking anywhere except the drag grip navigates. The grip is present but
 * inert in 5a (drag is wired in 5b) — it blocks navigation so a future
 * drag-start never doubles as a click-through.
 *
 * Thumbnail: 48px square chiclet — the hero image when one exists, otherwise a
 * camera-style placeholder on the warm `soft` surface.
 */
export default function RecipeRow({ recipe }: { recipe: RecipeSummary }) {
  const meta = [
    recipe.author ?? "no author yet",
    recipe.tags.length > 0 ? recipe.tags.slice(0, 2).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/admin/recipes/${recipe.slug}/edit`}
      className="group flex items-center gap-3 rounded-chiclet px-2 py-2.5 transition-colors hover:bg-soft"
    >
      {/* Drag grip — inert in 5a; preventDefault stops the row link firing. */}
      <span
        aria-hidden
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="flex shrink-0 cursor-grab text-ink-muted"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </span>

      {/* 48px square thumbnail */}
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

      {/* Title + meta */}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{recipe.title}</span>
        <span className="block truncate text-xs text-ink-muted">{meta}</span>
      </span>

      {/* Right cue — pencil chiclet; whole row navigates, this just signals it. */}
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chiclet border border-rule text-ink-soft transition-colors group-hover:border-accent group-hover:text-accent-ink"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </span>
    </Link>
  );
}
