/**
 * Core logic for the admin recipe-list mutations (category CRUD + recipe
 * reordering).
 *
 * Each function takes a Supabase client as its first argument and does all the
 * validation + database work, returning a plain { ok } / { ok:false, error }
 * result. They are deliberately FREE of request-context concerns — no
 * requireOwner(), no revalidatePath(), no next/headers — so they can be:
 *   • wrapped by the thin "use server" actions in app/admin/actions.ts
 *     (which add auth + cache revalidation and pass in supabaseAdmin), and
 *   • exercised directly by scripts/test-admin-actions.ts (which passes its
 *     own service-role client), running the SAME logic the actions run.
 *
 * Scope: these touch the `categories` and `recipes` tables only. Recipe
 * reordering goes through the reorder_recipes RPC (migration 008) for
 * atomicity. Nothing here touches recipe_steps or step_photos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify, slugifyUnique } from "@/lib/slugify";

export type CategoryRow = { slug: string; name: string; sort_order: number };

export type Ok<T> = { ok: true } & T;
export type Err = { ok: false; error: string };
export type Result<T = unknown> = Ok<T> | Err;

/** A group in a recipe-reorder request: the full new ordering of one category. */
export type RecipeGroup = { categorySlug: string; recipeSlugs: string[] };

const MAX_NAME = 100;

function err(error: string): Err {
  return { ok: false, error };
}

/** First value that appears more than once in the array, or null. */
function firstDuplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* A. Add a category                                                  */
/* ------------------------------------------------------------------ */
export async function addCategoryCore(
  db: SupabaseClient,
  name: string,
): Promise<Result<{ category: CategoryRow }>> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return err("Category name cannot be empty.");
  if (trimmed.length > MAX_NAME) {
    return err(`Category name is too long (max ${MAX_NAME} characters).`);
  }
  if (slugify(trimmed) === "") {
    return err("Category name must contain at least one letter or number.");
  }

  const { data: existing, error: readErr } = await db
    .from("categories")
    .select("slug, sort_order");
  if (readErr) return err(`Could not read categories: ${readErr.message}`);

  const rows = (existing ?? []) as { slug: string; sort_order: number }[];
  const slug = slugifyUnique(
    trimmed,
    rows.map((r) => r.slug),
  );
  const sort_order = rows.reduce((max, r) => Math.max(max, r.sort_order), -1) + 1;

  const { error: insErr } = await db
    .from("categories")
    .insert({ slug, name: trimmed, sort_order });
  if (insErr) return err(`Could not create category: ${insErr.message}`);

  return { ok: true, category: { slug, name: trimmed, sort_order } };
}

/* ------------------------------------------------------------------ */
/* B. Rename a category (name only; slug stays stable)                */
/* ------------------------------------------------------------------ */
export async function renameCategoryCore(
  db: SupabaseClient,
  slug: string,
  name: string,
): Promise<Result> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return err("Category name cannot be empty.");
  if (trimmed.length > MAX_NAME) {
    return err(`Category name is too long (max ${MAX_NAME} characters).`);
  }

  const { data: existing, error: readErr } = await db
    .from("categories")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) return err(`Could not read category: ${readErr.message}`);
  if (!existing) return err(`Category "${slug}" not found.`);

  const { error: upErr } = await db
    .from("categories")
    .update({ name: trimmed })
    .eq("slug", slug);
  if (upErr) return err(`Could not rename category: ${upErr.message}`);

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* C. Reorder categories                                              */
/* ------------------------------------------------------------------ */
export async function reorderCategoriesCore(
  db: SupabaseClient,
  orderedSlugs: string[],
): Promise<Result> {
  if (!Array.isArray(orderedSlugs) || orderedSlugs.length === 0) {
    return err("No categories to reorder.");
  }
  const dup = firstDuplicate(orderedSlugs);
  if (dup) return err(`Category "${dup}" appears more than once.`);

  const { data: cats, error: readErr } = await db
    .from("categories")
    .select("slug");
  if (readErr) return err(`Could not read categories: ${readErr.message}`);

  const dbSlugs = new Set((cats ?? []).map((c: { slug: string }) => c.slug));
  const payloadSet = new Set(orderedSlugs);
  const sameMembership =
    payloadSet.size === dbSlugs.size &&
    [...dbSlugs].every((s) => payloadSet.has(s));
  if (!sameMembership) {
    return err(
      `Category list is incomplete or stale (expected ${dbSlugs.size}, got ${payloadSet.size}). ` +
        "Refresh and retry.",
    );
  }

  // Sequential updates. There is no unique constraint on categories.sort_order,
  // so no parking/renumbering dance is needed; N is tiny (a handful of rows).
  for (let i = 0; i < orderedSlugs.length; i += 1) {
    const { error: upErr } = await db
      .from("categories")
      .update({ sort_order: i })
      .eq("slug", orderedSlugs[i]);
    if (upErr) return err(`Could not reorder categories: ${upErr.message}`);
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* D. Delete a category (only if empty)                               */
/* ------------------------------------------------------------------ */
export async function deleteCategoryCore(
  db: SupabaseClient,
  slug: string,
): Promise<Result> {
  const { data: existing, error: readErr } = await db
    .from("categories")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) return err(`Could not read category: ${readErr.message}`);
  if (!existing) return err(`Category "${slug}" not found.`);

  const { count, error: countErr } = await db
    .from("recipes")
    .select("slug", { count: "exact", head: true })
    .eq("category_slug", slug);
  if (countErr) return err(`Could not count recipes: ${countErr.message}`);
  if ((count ?? 0) > 0) {
    return err(
      "Cannot delete a category that has recipes in it. " +
        "Please move or recategorize the recipes first.",
    );
  }

  // The DB FK (recipes.category_slug → categories.slug, no ON DELETE CASCADE =
  // RESTRICT) is a backstop: if a recipe were added in a race, this delete
  // would fail rather than orphan it.
  const { error: delErr } = await db
    .from("categories")
    .delete()
    .eq("slug", slug);
  if (delErr) return err(`Could not delete category: ${delErr.message}`);

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* E. Reorder recipes (within a category and/or across categories)    */
/* ------------------------------------------------------------------ */
export async function reorderRecipesCore(
  db: SupabaseClient,
  groups: RecipeGroup[],
): Promise<Result> {
  if (!Array.isArray(groups) || groups.length === 0) {
    return err("No reorder groups provided.");
  }
  for (const g of groups) {
    if (!g || typeof g.categorySlug !== "string" || !Array.isArray(g.recipeSlugs)) {
      return err("Malformed reorder payload.");
    }
  }

  // A category may appear at most once across the groups.
  const dupCat = firstDuplicate(groups.map((g) => g.categorySlug));
  if (dupCat) return err(`Category "${dupCat}" appears in more than one group.`);

  // A recipe may appear at most once across ALL groups (two positions = bug).
  const allSlugs = groups.flatMap((g) => g.recipeSlugs);
  const dupRecipe = firstDuplicate(allSlugs);
  if (dupRecipe) {
    return err(`Recipe "${dupRecipe}" appears more than once in the payload.`);
  }

  const affected = groups.map((g) => g.categorySlug);

  // Validate every affected category exists (the RPC also checks; this gives a
  // cleaner error earlier).
  const { data: cats, error: catErr } = await db
    .from("categories")
    .select("slug")
    .in("slug", affected);
  if (catErr) return err(`Could not read categories: ${catErr.message}`);
  const existingCats = new Set((cats ?? []).map((c: { slug: string }) => c.slug));
  const missingCat = affected.find((c) => !existingCats.has(c));
  if (missingCat) return err(`Unknown category "${missingCat}".`);

  // ---- COMPLETENESS CHECK (the critical safety bit) ----
  // The union (across affected categories) of recipes CURRENTLY in the DB must
  // equal the union (across all groups) of recipes in the payload. This works
  // for both within-category reorders and cross-category moves: a recipe that
  // moves from A to B is counted once in each union (DB via A, payload via B).
  // It catches a stale page (a recipe missing from the payload) AND a forgotten
  // source group (a recipe present in the payload but not currently in any
  // affected category).
  const { data: dbRecipes, error: recErr } = await db
    .from("recipes")
    .select("slug, category_slug")
    .in("category_slug", affected);
  if (recErr) return err(`Could not read recipes: ${recErr.message}`);

  const dbUnion = new Set((dbRecipes ?? []).map((r: { slug: string }) => r.slug));
  const payloadUnion = new Set(allSlugs);
  const missing = [...dbUnion].filter((s) => !payloadUnion.has(s));
  const extra = [...payloadUnion].filter((s) => !dbUnion.has(s));
  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(
        `${missing.length} recipe(s) missing from the payload (e.g. ${missing.slice(0, 3).join(", ")})`,
      );
    }
    if (extra.length > 0) {
      parts.push(
        `${extra.length} unexpected recipe(s) not currently in these categories (e.g. ${extra.slice(0, 3).join(", ")})`,
      );
    }
    return err(
      `Reorder payload doesn't match the current recipes in the affected ` +
        `categor${affected.length === 1 ? "y" : "ies"}: ${parts.join("; ")}. ` +
        "The page may be stale — refresh and retry.",
    );
  }

  // ---- Atomic write via the RPC (dense 0..n-1 per category). ----
  const rpcGroups = groups.map((g) => ({
    category_slug: g.categorySlug,
    recipe_slugs: g.recipeSlugs,
  }));
  const { error: rpcErr } = await db.rpc("reorder_recipes", { groups: rpcGroups });
  if (rpcErr) return err(`Could not save the new order: ${rpcErr.message}`);

  return { ok: true };
}
