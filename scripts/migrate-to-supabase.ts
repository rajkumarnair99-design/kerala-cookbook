/**
 * scripts/migrate-to-supabase.ts
 *
 * One-shot migration: reads seed-recipes.json and loads everything into
 * Supabase — the cookbook metadata, the 7 categories, and all recipes
 * with their ingredients, steps, and step photos.
 *
 * Run with:  npx tsx scripts/migrate-to-supabase.ts
 *
 * SAFETY: this script refuses to run if the recipes, categories, or
 * cookbook_meta tables already contain any rows, so it cannot create
 * duplicates if it is run twice by accident.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load Supabase keys from .env.local
dotenv.config({ path: join(rootDir, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

// The secret key bypasses Row Level Security so the script can write.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// ---- Types matching the shape of seed-recipes.json -------------------
type SeedIngredient = {
  section: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
};
type SeedStep = {
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  tip: string | null;
  image_urls?: string[] | null;
};
type SeedRecipe = {
  slug: string;
  title: string;
  subtitle: string;
  category_slug: string;
  serves: string;
  tags: string[];
  source: string;
  notes: string;
  video_url?: string | null;
  ingredients: SeedIngredient[];
  steps: SeedStep[];
};
type Seed = {
  source: {
    book_title: string;
    recipes_by: string;
    translated_by: string;
    year: number;
    note: string;
  };
  categories: { slug: string; name: string }[];
  recipes: SeedRecipe[];
};

// ---- Helpers ---------------------------------------------------------
function bail(message: string, error: unknown): never {
  console.error(`\n❌ ${message}`);
  console.error(error);
  process.exit(1);
}

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) bail(`Could not read the "${table}" table.`, error);
  return count ?? 0;
}

// ---- Migration -------------------------------------------------------
async function main() {
  const seed: Seed = JSON.parse(
    readFileSync(join(rootDir, "seed-recipes.json"), "utf8"),
  );
  console.log(
    `Read seed-recipes.json — ${seed.categories.length} categories, ` +
      `${seed.recipes.length} recipes.`,
  );

  // Safety guard: refuse to run if any data already exists.
  for (const table of ["recipes", "categories", "cookbook_meta"]) {
    const existing = await countRows(table);
    if (existing > 0) {
      console.error(
        `\n❌ The "${table}" table already has ${existing} row(s).\n` +
          `   This one-shot migration will not run again, to avoid duplicates.\n` +
          `   To start over, empty all six tables in Supabase, then re-run.`,
      );
      process.exit(1);
    }
  }

  // 1. Cookbook metadata (a single row) --------------------------------
  const { error: metaError } = await supabase.from("cookbook_meta").insert({
    id: 1,
    book_title: seed.source.book_title,
    recipes_by: seed.source.recipes_by,
    translated_by: seed.source.translated_by,
    year: seed.source.year,
    note: seed.source.note,
  });
  if (metaError) bail("Failed inserting cookbook_meta.", metaError);
  console.log("✓ cookbook_meta inserted.");

  // 2. Categories (sort_order preserves the original order) ------------
  const { error: catError } = await supabase.from("categories").insert(
    seed.categories.map((category, index) => ({
      slug: category.slug,
      name: category.name,
      sort_order: index,
    })),
  );
  if (catError) bail("Failed inserting categories.", catError);
  console.log(`✓ ${seed.categories.length} categories inserted.`);

  // 3. Recipes + ingredients + steps + photos --------------------------
  let ingredientTotal = 0;
  let stepTotal = 0;
  let photoTotal = 0;

  // Recipes are inserted ONE AT A TIME, in file order, so each recipe's
  // auto-assigned id follows the original order. This is what keeps the
  // home page's "Recently added" and the category pages looking identical.
  for (const [index, recipe] of seed.recipes.entries()) {
    const { data: insertedRecipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        slug: recipe.slug,
        title: recipe.title,
        subtitle: recipe.subtitle,
        category_slug: recipe.category_slug,
        serves: recipe.serves,
        tags: recipe.tags,
        source: recipe.source,
        notes: recipe.notes,
        video_url: recipe.video_url ?? null,
      })
      .select("id")
      .single();
    if (recipeError || !insertedRecipe) {
      bail(`Failed inserting recipe "${recipe.slug}".`, recipeError);
    }
    const recipeId = insertedRecipe.id as number;

    // Ingredients
    if (recipe.ingredients.length > 0) {
      const { error } = await supabase.from("recipe_ingredients").insert(
        recipe.ingredients.map((ingredient, i) => ({
          recipe_id: recipeId,
          section: ingredient.section,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          preparation: ingredient.preparation,
          optional: ingredient.optional,
          sort_order: i,
        })),
      );
      if (error) {
        bail(`Failed inserting ingredients for "${recipe.slug}".`, error);
      }
      ingredientTotal += recipe.ingredients.length;
    }

    // Steps — insert and read the new ids back so photos can attach.
    if (recipe.steps.length > 0) {
      const { data: insertedSteps, error } = await supabase
        .from("recipe_steps")
        .insert(
          recipe.steps.map((step) => ({
            recipe_id: recipeId,
            step_number: step.step_number,
            instruction: step.instruction,
            timer_minutes: step.timer_minutes,
            tip: step.tip,
          })),
        )
        .select("id, step_number");
      if (error || !insertedSteps) {
        bail(`Failed inserting steps for "${recipe.slug}".`, error);
      }
      stepTotal += recipe.steps.length;

      // Map each step_number to its new database id.
      const stepIdByNumber = new Map<number, number>();
      for (const step of insertedSteps) {
        stepIdByNumber.set(step.step_number as number, step.id as number);
      }

      // Step photos (only Nadan Chicken Curry has these today).
      const photoRows: { step_id: number; url: string; sort_order: number }[] =
        [];
      for (const step of recipe.steps) {
        const stepId = stepIdByNumber.get(step.step_number);
        if (stepId === undefined) continue;
        (step.image_urls ?? []).forEach((url, i) => {
          photoRows.push({ step_id: stepId, url, sort_order: i });
        });
      }
      if (photoRows.length > 0) {
        const { error: photoError } = await supabase
          .from("step_photos")
          .insert(photoRows);
        if (photoError) {
          bail(`Failed inserting step photos for "${recipe.slug}".`, photoError);
        }
        photoTotal += photoRows.length;
      }
    }

    console.log(`  [${index + 1}/${seed.recipes.length}] ${recipe.slug}`);
  }

  // 4. Verify by counting every table ----------------------------------
  console.log("\nMigration finished — verifying row counts...");
  for (const table of [
    "cookbook_meta",
    "categories",
    "recipes",
    "recipe_ingredients",
    "recipe_steps",
    "step_photos",
  ]) {
    console.log(`  ${table}: ${await countRows(table)} rows`);
  }

  console.log(
    `\n✅ Done. Inserted ${seed.recipes.length} recipes, ` +
      `${ingredientTotal} ingredients, ${stepTotal} steps, ` +
      `${photoTotal} step photos.`,
  );
}

main().catch((err) => bail("Unexpected error.", err));
