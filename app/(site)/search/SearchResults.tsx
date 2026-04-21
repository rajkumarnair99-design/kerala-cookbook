"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import RecipeCard from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";

type Props = {
  recipes: Recipe[];
};

function matches(recipe: Recipe, q: string): boolean {
  const haystack = [
    recipe.title,
    recipe.subtitle,
    ...recipe.tags,
    ...recipe.ingredients.map((i) => i.name),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default function SearchResults({ recipes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);

  // keep the URL in sync without scrolling
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (current === query) return;
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set("q", query);
    else params.delete("q");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return recipes.filter((r) => matches(r, q));
  }, [query, recipes]);

  return (
    <div>
      <div className="flex items-center gap-2 border border-rule bg-surface rounded-full px-4 py-3 focus-within:border-accent-soft focus-within:ring-2 focus-within:ring-accent-soft/20">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="w-5 h-5 text-ink-muted flex-none"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, tag, or ingredient…"
          aria-label="Search recipes"
          className="w-full bg-transparent outline-none placeholder:text-ink-muted/70"
        />
      </div>

      <div className="mt-10">
        {query.trim() === "" ? (
          <p className="text-ink-muted italic">
            Start typing to search {recipes.length} recipes.
          </p>
        ) : results.length === 0 ? (
          <p className="text-ink-soft">
            No recipes match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-muted mb-6">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {results.map((r) => (
                <RecipeCard key={r.slug} recipe={r} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
