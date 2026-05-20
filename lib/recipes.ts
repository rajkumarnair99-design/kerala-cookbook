import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Category,
  CookbookSource,
  Ingredient,
  Recipe,
  Step,
} from "@/types/recipe";

/**
 * Data layer for the cookbook. Every function reads from Supabase and
 * returns the same shapes the app already used (see types/recipe.ts),
 * so the presentational components did not need to change.
 *
 * Each function is wrapped in React `cache` to de-duplicate identical
 * queries within a single page render (e.g. generateMetadata + the page).
 */

// Columns for a full recipe, with nested ingredients, steps, and step
// photos. Their order is applied in JS by the mappers below.
const RECIPE_SELECT = `
  slug,
  title,
  subtitle,
  category_slug,
  serves,
  tags,
  source,
  notes,
  video_url,
  recipe_ingredients ( section, name, quantity, unit, preparation, optional, sort_order ),
  recipe_steps ( step_number, instruction, timer_minutes, tip,
    step_photos ( url, sort_order )
  )
`;

type IngredientRow = {
  section: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
  sort_order: number;
};
type PhotoRow = { url: string; sort_order: number };
type StepRow = {
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  tip: string | null;
  step_photos: PhotoRow[] | null;
};
type RecipeRow = {
  slug: string;
  title: string;
  subtitle: string;
  category_slug: string;
  serves: string;
  tags: string[] | null;
  source: string;
  notes: string;
  video_url: string | null;
  recipe_ingredients: IngredientRow[] | null;
  recipe_steps: StepRow[] | null;
};

// Convert a database row (with nested arrays) into the app's Recipe type.
function toRecipe(row: RecipeRow): Recipe {
  const ingredients: Ingredient[] = (row.recipe_ingredients ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      section: i.section,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      preparation: i.preparation,
      optional: i.optional,
    }));

  const steps: Step[] = (row.recipe_steps ?? [])
    .slice()
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => ({
      step_number: s.step_number,
      instruction: s.instruction,
      timer_minutes: s.timer_minutes,
      tip: s.tip,
      image_urls: (s.step_photos ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => p.url),
    }));

  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category_slug: row.category_slug,
    serves: row.serves,
    tags: row.tags ?? [],
    source: row.source,
    notes: row.notes,
    video_url: row.video_url,
    ingredients,
    steps,
  };
}

export const getSource = cache(async (): Promise<CookbookSource> => {
  const { data, error } = await supabase
    .from("cookbook_meta")
    .select("book_title, recipes_by, translated_by, year, note")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Failed to load cookbook info: ${error.message}`);
  return data as unknown as CookbookSource;
});

export const getAllCategories = cache(async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from("categories")
    .select("slug, name")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return (data ?? []) as unknown as Category[];
});

export const getCategoryBySlug = cache(
  async (slug: string): Promise<Category | undefined> => {
    const { data, error } = await supabase
      .from("categories")
      .select("slug, name")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`Failed to load category: ${error.message}`);
    return (data as unknown as Category) ?? undefined;
  },
);

export const getAllRecipes = cache(async (): Promise<Recipe[]> => {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .order("id", { ascending: true });
  if (error) throw new Error(`Failed to load recipes: ${error.message}`);
  return ((data ?? []) as unknown as RecipeRow[]).map(toRecipe);
});

export const getRecipeBySlug = cache(
  async (slug: string): Promise<Recipe | undefined> => {
    const { data, error } = await supabase
      .from("recipes")
      .select(RECIPE_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load recipe "${slug}": ${error.message}`);
    }
    return data ? toRecipe(data as unknown as RecipeRow) : undefined;
  },
);

export const getRecipesByCategory = cache(
  async (categorySlug: string): Promise<Recipe[]> => {
    const { data, error } = await supabase
      .from("recipes")
      .select(RECIPE_SELECT)
      .eq("category_slug", categorySlug)
      .order("id", { ascending: true });
    if (error) {
      throw new Error(`Failed to load recipes for category: ${error.message}`);
    }
    return ((data ?? []) as unknown as RecipeRow[]).map(toRecipe);
  },
);

export const getRecentRecipes = cache(async (count = 4): Promise<Recipe[]> => {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .order("id", { ascending: false })
    .limit(count);
  if (error) {
    throw new Error(`Failed to load recent recipes: ${error.message}`);
  }
  return ((data ?? []) as unknown as RecipeRow[]).map(toRecipe);
});

export const getCategoryCounts = cache(
  async (): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from("recipes")
      .select("category_slug");
    if (error) {
      throw new Error(`Failed to count recipes per category: ${error.message}`);
    }
    const rows = (data ?? []) as unknown as { category_slug: string }[];
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.category_slug] = (counts[row.category_slug] ?? 0) + 1;
    }
    return counts;
  },
);
