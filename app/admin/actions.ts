"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  addCategoryCore,
  renameCategoryCore,
  reorderCategoriesCore,
  deleteCategoryCore,
  reorderRecipesCore,
  moveRecipeCore,
  type CategoryRow,
  type RecipeGroup,
  type Result,
} from "@/lib/admin-actions-core";

/**
 * Server actions for the admin recipe list: category CRUD + recipe
 * reordering. Each is a thin wrapper that (1) re-checks the owner — Server
 * Actions are reachable by direct POST, so the proxy alone is not enough —
 * (2) runs the shared core logic against the service-role client, and
 * (3) revalidates the cache on success so the list and the editor's category
 * dropdown pick up the change.
 *
 * All validation + DB work lives in lib/admin-actions-core.ts, which the test
 * script exercises directly with the same logic.
 *
 * NOTE: saving a recipe (including the bottom-of-category-on-change behaviour
 * from migration 007) is handled by the editor's existing saveRecipe action in
 * app/admin/recipes/[slug]/edit/actions.ts — it is unchanged by this work.
 */

export async function addCategory(
  name: string,
): Promise<Result<{ category: CategoryRow }>> {
  await requireOwner();
  const result = await addCategoryCore(supabaseAdmin, name);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function renameCategory(
  slug: string,
  name: string,
): Promise<Result> {
  await requireOwner();
  const result = await renameCategoryCore(supabaseAdmin, slug, name);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function reorderCategories(
  orderedSlugs: string[],
): Promise<Result> {
  await requireOwner();
  const result = await reorderCategoriesCore(supabaseAdmin, orderedSlugs);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteCategory(slug: string): Promise<Result> {
  await requireOwner();
  const result = await deleteCategoryCore(supabaseAdmin, slug);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function reorderRecipes(groups: RecipeGroup[]): Promise<Result> {
  await requireOwner();
  const result = await reorderRecipesCore(supabaseAdmin, groups);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function moveRecipe(
  recipeSlug: string,
  targetCategorySlug: string,
): Promise<Result> {
  await requireOwner();
  const result = await moveRecipeCore(supabaseAdmin, {
    recipeSlug,
    targetCategorySlug,
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
