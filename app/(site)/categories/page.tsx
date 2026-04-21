import type { Metadata } from "next";
import CategoryCard from "@/components/CategoryCard";
import { getAllCategories, getRecipeCountByCategory } from "@/lib/recipes";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse all recipe categories in the family cookbook.",
};

export default function CategoriesPage() {
  const categories = getAllCategories();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <header className="max-w-3xl mb-10 sm:mb-12">
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-accent-ink mb-4">
          All Categories
        </div>
        <h1 className="font-serif text-[34px] sm:text-5xl text-ink leading-tight">
          Seven sections of a Kerala kitchen
        </h1>
        <p className="mt-5 sm:mt-6 text-base sm:text-lg text-ink-soft leading-relaxed">
          From everyday breakfasts to feast-day centrepieces — each section
          holds the recipes we return to, again and again.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {categories.map((category) => (
          <CategoryCard
            key={category.slug}
            category={category}
            count={getRecipeCountByCategory(category.slug)}
          />
        ))}
      </div>
    </div>
  );
}
