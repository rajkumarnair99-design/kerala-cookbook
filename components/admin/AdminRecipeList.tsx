"use client";

import { useEffect, useState } from "react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import AddCategoryControl from "./AddCategoryControl";
import CategorySection from "./CategorySection";

/**
 * The admin recipe list: a grouped, view-first screen. Recipes are grouped by
 * category (categories in their sort_order; recipes in their within-category
 * sort_order). Clicking a row opens the editor.
 *
 * 5a is static: affordances (grips, pencils, trash, "+ Add category") are all
 * visible but inert except the per-category collapse chevron. This component
 * will grow the drag state (5b) and category-CRUD wiring (5c); for now it just
 * buckets the recipes and renders the sections, plus a placeholder toast for
 * the inert "+ Add category".
 */
export default function AdminRecipeList({
  categories,
  recipes,
}: {
  categories: AdminCategory[];
  recipes: RecipeSummary[];
}) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Bucket recipes by category. They arrive ordered by (category, sort_order),
  // so each bucket is already in within-category order.
  const byCategory = new Map<string, RecipeSummary[]>();
  for (const recipe of recipes) {
    const bucket = byCategory.get(recipe.categorySlug) ?? [];
    bucket.push(recipe);
    byCategory.set(recipe.categorySlug, bucket);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">Recipes</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Click a recipe to edit. Drag to reorder.
          </p>
        </div>
        <AddCategoryControl
          onClick={() => setToast("Add category — wiring coming next")}
        />
      </div>

      {/* Grouped list */}
      <div className="mt-8 space-y-4">
        {categories.map((category) => (
          <CategorySection
            key={category.slug}
            category={category}
            recipes={byCategory.get(category.slug) ?? []}
          />
        ))}
      </div>

      {/* Placeholder toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4">
          <div className="rounded-chiclet bg-ink px-4 py-3 text-sm text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
