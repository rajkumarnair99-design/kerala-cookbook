import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeCard from "@/components/RecipeCard";
import {
  getAllCategories,
  getCategoryBySlug,
  getRecipesByCategory,
} from "@/lib/recipes";

export async function generateStaticParams() {
  return getAllCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(
  props: PageProps<"/categories/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: `${category.name} — recipes from the family cookbook.`,
  };
}

export default async function CategoryPage(
  props: PageProps<"/categories/[slug]">,
) {
  const { slug } = await props.params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const recipes = getRecipesByCategory(category.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <nav className="mb-6 sm:mb-8 text-sm text-ink-muted">
        <Link href="/categories" className="hover:text-accent-ink">
          ← All categories
        </Link>
      </nav>
      <header className="max-w-3xl mb-10 sm:mb-12">
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-accent-ink mb-4">
          Category
        </div>
        <h1 className="font-serif text-[34px] sm:text-5xl text-ink leading-tight">
          {category.name}
        </h1>
        <p className="mt-3 sm:mt-4 text-sm text-ink-muted">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
        </p>
      </header>
      {recipes.length === 0 ? (
        <p className="text-ink-soft italic">No recipes in this section yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.slug}
              recipe={recipe}
              showCategory={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
