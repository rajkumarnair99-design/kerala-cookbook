"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRecipeForEditor } from "@/lib/recipes";
import type { EditorRecipe, SaveResult } from "@/types/recipe";

/**
 * Saves an entire recipe — top-level fields, ingredients, and steps — in a
 * single database transaction via the save_recipe function.
 *
 * Auth is re-checked here: Server Actions are reachable by direct POST, so
 * they must verify the caller themselves; the proxy alone is not enough.
 */
export async function saveRecipe(recipe: EditorRecipe): Promise<SaveResult> {
  await requireOwner();

  if (!recipe.slug) {
    return { ok: false, error: "This recipe has no slug — cannot save." };
  }
  if (!recipe.title.trim()) {
    return { ok: false, error: "Title cannot be empty." };
  }
  if (!recipe.category_slug) {
    return { ok: false, error: "Please choose a category." };
  }

  // Shape the editor state into the payload the save_recipe function wants:
  // sections get their sort_order, ingredients get sort_order + their
  // section reference (either an existing section_id or a client_key
  // pointing at a newly-added section in the same payload), steps get a
  // 1-based step_number.
  const payload = {
    slug: recipe.slug,
    title: recipe.title.trim(),
    subtitle: recipe.subtitle,
    category_slug: recipe.category_slug,
    serves: recipe.serves,
    tags: recipe.tags,
    source: recipe.source,
    notes: recipe.notes,
    story: recipe.story,
    author: recipe.author,
    hero_image_url: recipe.hero_image_url,
    sections: recipe.sections.map((section, index) => ({
      id: section.id,
      client_key: section.client_key,
      name: section.name,
      sort_order: index,
      collapsed: section.collapsed,
    })),
    ingredients: recipe.ingredients.map((ing, index) => ({
      id: ing.id,
      section_id: ing.section_id,
      section_client_key: ing.section_client_key,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      preparation: ing.preparation,
      optional: ing.optional,
      sort_order: index,
    })),
    steps: recipe.steps.map((step, index) => ({
      id: step.id,
      step_number: index + 1,
      instruction: step.instruction,
      timer_minutes: step.timer_minutes,
      tip: step.tip,
    })),
  };

  const { error } = await supabaseAdmin.rpc("save_recipe", { payload });
  if (error) {
    return { ok: false, error: error.message };
  }

  // The recipe surfaces on many public pages; refresh them all.
  revalidatePath("/", "layout");

  // Reload so the editor picks up real ids for any newly added steps.
  const updated = await getRecipeForEditor(recipe.slug);
  if (!updated) {
    return { ok: false, error: "Saved, but the recipe could not be reloaded." };
  }
  return { ok: true, recipe: updated };
}
