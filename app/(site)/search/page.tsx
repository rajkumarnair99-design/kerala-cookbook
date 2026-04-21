import type { Metadata } from "next";
import { Suspense } from "react";
import SearchResults from "./SearchResults";
import { getAllRecipes } from "@/lib/recipes";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the family cookbook by recipe name, tag, or ingredient.",
};

export default function SearchPage() {
  const recipes = getAllRecipes();
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-16">
      <header className="mb-8 sm:mb-10">
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-accent-ink mb-4">
          Search
        </div>
        <h1 className="font-serif text-[34px] sm:text-5xl text-ink leading-tight">
          Find a recipe
        </h1>
        <p className="mt-3 sm:mt-4 text-ink-soft">
          Type a dish, a tag like &ldquo;curry&rdquo;, or an ingredient.
        </p>
      </header>
      <Suspense fallback={<div className="h-14 rounded-full bg-surface border border-rule animate-pulse" />}>
        <SearchResults recipes={recipes} />
      </Suspense>
    </div>
  );
}
