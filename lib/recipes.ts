import seedData from "@/seed-recipes.json";
import type { Category, Cookbook, Recipe } from "@/types/recipe";

const cookbook = seedData as Cookbook;

export function getSource() {
  return cookbook.source;
}

export function getAllRecipes(): Recipe[] {
  return cookbook.recipes;
}

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return cookbook.recipes.find((recipe) => recipe.slug === slug);
}

export function getAllCategories(): Category[] {
  return cookbook.categories;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return cookbook.categories.find((category) => category.slug === slug);
}

export function getRecipesByCategory(categorySlug: string): Recipe[] {
  return cookbook.recipes.filter(
    (recipe) => recipe.category_slug === categorySlug,
  );
}

export function getRecipeCountByCategory(categorySlug: string): number {
  return getRecipesByCategory(categorySlug).length;
}

export function getRecentRecipes(count = 4): Recipe[] {
  // Without timestamps, treat the last N entries in the file as "recently added".
  return cookbook.recipes.slice(-count).reverse();
}

export function searchRecipes(query: string): Recipe[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return cookbook.recipes.filter((recipe) => {
    const haystack = [
      recipe.title,
      recipe.subtitle,
      ...recipe.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
