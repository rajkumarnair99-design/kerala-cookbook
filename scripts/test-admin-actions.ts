/**
 * Isolated test of the admin action CORE logic (lib/admin-actions-core.ts) —
 * the same functions the "use server" actions call, minus requireOwner /
 * revalidatePath. Runs against the real database with its own service-role
 * client, performs REAL mutations, then fully restores the captured
 * before-state (try/finally) and verifies the restoration.
 *
 *   npx tsx scripts/test-admin-actions.ts
 *
 * Safety: touches the categories and recipes tables only (never steps/photos).
 * Any category it creates is deleted; any reordering it performs is reverted;
 * a final integrity check confirms the DB matches the captured baseline.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { slugify, slugifyUnique } from "@/lib/slugify";
import {
  addCategoryCore,
  renameCategoryCore,
  reorderCategoriesCore,
  deleteCategoryCore,
  reorderRecipesCore,
} from "@/lib/admin-actions-core";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (ok) passed += 1;
  else failed += 1;
}

type CatSnap = { slug: string; name: string; sort_order: number };
type RecSnap = { slug: string; category_slug: string; sort_order: number };

async function orderedSlugs(db: SupabaseClient, categorySlug: string): Promise<string[]> {
  const { data } = await db
    .from("recipes")
    .select("slug")
    .eq("category_slug", categorySlug)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r: { slug: string }) => r.slug);
}

async function readCats(db: SupabaseClient): Promise<CatSnap[]> {
  const { data } = await db
    .from("categories")
    .select("slug, name, sort_order")
    .order("sort_order", { ascending: true });
  return (data ?? []) as CatSnap[];
}

async function readRecipes(db: SupabaseClient): Promise<RecSnap[]> {
  const { data } = await db
    .from("recipes")
    .select("slug, category_slug, sort_order");
  return (data ?? []) as RecSnap[];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\nAdmin Actions — Core Logic Test");
  console.log("─────────────────────────────────────────────");

  // ---- slugify unit checks ----
  check('slugify "Pickles & Preserves"', slugify("Pickles & Preserves") === "pickles-preserves");
  check('slugify "Café Specials"', slugify("Café Specials") === "cafe-specials");
  check('slugify "Soup / Stews"', slugify("Soup / Stews") === "soup-stews");
  check(
    "slugifyUnique suffixes on collision",
    slugifyUnique("Meat Dishes", ["meat-dishes"]) === "meat-dishes-2",
  );

  // ---- capture baseline for restoration ----
  const catsBefore = await readCats(db);
  const recipesBefore = await readRecipes(db);
  const beforeCatSlugs = new Set(catsBefore.map((c) => c.slug));
  const maxCatSort = catsBefore.reduce((m, c) => Math.max(m, c.sort_order), -1);

  try {
    /* A. addCategory ------------------------------------------------ */
    const a1 = await addCategoryCore(db, "Test Category");
    check("addCategory ok", a1.ok, a1.ok ? "" : a1.error);
    check("addCategory slug = test-category", a1.ok && a1.category.slug === "test-category",
      a1.ok ? a1.category.slug : "");
    check("addCategory sort_order = maxBefore+1",
      a1.ok && a1.category.sort_order === maxCatSort + 1,
      a1.ok ? `got ${a1.category.sort_order}, expected ${maxCatSort + 1}` : "");

    /* B. renameCategory --------------------------------------------- */
    const b1 = await renameCategoryCore(db, "test-category", "Renamed Test");
    check("renameCategory ok", b1.ok, b1.ok ? "" : b1.error);
    {
      const cats = await readCats(db);
      const tc = cats.find((c) => c.slug === "test-category");
      check("rename changed name, slug stable",
        !!tc && tc.name === "Renamed Test" && tc.slug === "test-category",
        tc ? `name="${tc.name}" slug="${tc.slug}"` : "row missing");
    }

    /* A again: unique-suffixing ------------------------------------- */
    const a2 = await addCategoryCore(db, "Test Category");
    check("addCategory duplicate-name → slug test-category-2",
      a2.ok && a2.category.slug === "test-category-2",
      a2.ok ? a2.category.slug : (a2 as { error: string }).error);
    check("addCategory #2 sort_order = maxBefore+2",
      a2.ok && a2.category.sort_order === maxCatSort + 2,
      a2.ok ? `got ${a2.category.sort_order}` : "");

    /* C. reorderCategories ------------------------------------------ */
    {
      const cats = await readCats(db); // current order incl. the 2 test cats
      const order = cats.map((c) => c.slug);
      const c1 = await reorderCategoriesCore(db, order);
      check("reorderCategories (current order) ok", c1.ok, c1.ok ? "" : c1.error);
      const after = await readCats(db);
      const correct = order.every((slug, i) => {
        const row = after.find((c) => c.slug === slug);
        return row && row.sort_order === i;
      });
      check("reorderCategories wrote sort_order = index", correct);

      // completeness refusal: omit one slug
      const incomplete = order.slice(0, -1);
      const c2 = await reorderCategoriesCore(db, incomplete);
      check("reorderCategories incomplete → refused",
        !c2.ok && /incomplete|stale/i.test((c2 as { error: string }).error),
        c2.ok ? "unexpectedly ok" : (c2 as { error: string }).error);
    }

    /* D. deleteCategory --------------------------------------------- */
    {
      const d1 = await deleteCategoryCore(db, "test-category");
      const d2 = await deleteCategoryCore(db, "test-category-2");
      check("deleteCategory (empty) test-category ok", d1.ok, d1.ok ? "" : d1.error);
      check("deleteCategory (empty) test-category-2 ok", d2.ok, d2.ok ? "" : d2.error);
      const cats = await readCats(db);
      check("test categories removed",
        !cats.some((c) => c.slug === "test-category" || c.slug === "test-category-2"));

      // non-empty refusal with the exact message
      const d3 = await deleteCategoryCore(db, "meat-dishes");
      check("deleteCategory (non-empty) meat-dishes → refused",
        !d3.ok &&
          (d3 as { error: string }).error ===
            "Cannot delete a category that has recipes in it. Please move or recategorize the recipes first.",
        d3.ok ? "unexpectedly ok" : (d3 as { error: string }).error);
    }

    /* E. reorderRecipes --------------------------------------------- */
    const eggBefore = await orderedSlugs(db, "egg-dishes");
    const riceBefore = await orderedSlugs(db, "rice-noodles");

    // complete, no-op (same order)
    {
      const e1 = await reorderRecipesCore(db, [
        { categorySlug: "egg-dishes", recipeSlugs: eggBefore },
      ]);
      check("reorderRecipes complete (no-op) ok", e1.ok, e1.ok ? "" : e1.error);
    }

    // incomplete payload → refused
    {
      const e2 = await reorderRecipesCore(db, [
        { categorySlug: "egg-dishes", recipeSlugs: eggBefore.slice(0, -1) },
      ]);
      check("reorderRecipes incomplete → refused",
        !e2.ok && /missing|stale/i.test((e2 as { error: string }).error),
        e2.ok ? "unexpectedly ok" : (e2 as { error: string }).error);
    }

    // cross-category move: egg-dishes[0] → end of rice-noodles
    {
      const moved = eggBefore[0];
      const srcAfter = eggBefore.slice(1);
      const destAfter = [...riceBefore, moved];
      const e3 = await reorderRecipesCore(db, [
        { categorySlug: "egg-dishes", recipeSlugs: srcAfter },
        { categorySlug: "rice-noodles", recipeSlugs: destAfter },
      ]);
      check("reorderRecipes cross-category move ok", e3.ok, e3.ok ? "" : e3.error);

      const recs = await readRecipes(db);
      const movedRow = recs.find((r) => r.slug === moved);
      check("moved recipe now in rice-noodles at the end",
        !!movedRow && movedRow.category_slug === "rice-noodles" &&
          movedRow.sort_order === riceBefore.length,
        movedRow ? `cat=${movedRow.category_slug} pos=${movedRow.sort_order}` : "missing");
      const eggNow = await orderedSlugs(db, "egg-dishes");
      const riceNow = await orderedSlugs(db, "rice-noodles");
      check("egg-dishes re-densified after move",
        eggNow.length === srcAfter.length && eggNow.every((s, i) => s === srcAfter[i]));
      check("rice-noodles dense with moved at end",
        riceNow.length === destAfter.length && riceNow[riceNow.length - 1] === moved);

      // move it back via the action (restores)
      const e4 = await reorderRecipesCore(db, [
        { categorySlug: "egg-dishes", recipeSlugs: eggBefore },
        { categorySlug: "rice-noodles", recipeSlugs: riceBefore },
      ]);
      check("reorderRecipes move-back ok", e4.ok, e4.ok ? "" : e4.error);
      const eggRestored = await orderedSlugs(db, "egg-dishes");
      check("egg-dishes restored to original order",
        eggRestored.length === eggBefore.length && eggRestored.every((s, i) => s === eggBefore[i]));
    }
  } finally {
    /* ---- Restoration backstop: guarantee the baseline, whatever happened ---- */
    // 1. delete any category created during the test (not in the baseline)
    const catsNow = await readCats(db);
    for (const c of catsNow) {
      if (!beforeCatSlugs.has(c.slug)) {
        await db.from("categories").delete().eq("slug", c.slug);
      }
    }
    // 2. restore each baseline category's name + sort_order
    for (const c of catsBefore) {
      await db.from("categories").update({ name: c.name, sort_order: c.sort_order }).eq("slug", c.slug);
    }
    // 3. restore any recipe whose category/position drifted
    const recsNow = await readRecipes(db);
    const nowMap = new Map(recsNow.map((r) => [r.slug, r]));
    for (const r of recipesBefore) {
      const cur = nowMap.get(r.slug);
      if (!cur || cur.category_slug !== r.category_slug || cur.sort_order !== r.sort_order) {
        await db.from("recipes")
          .update({ category_slug: r.category_slug, sort_order: r.sort_order })
          .eq("slug", r.slug);
      }
    }

    // 4. integrity verify: DB must match the captured baseline exactly
    const catsFinal = await readCats(db);
    const recsFinal = await readRecipes(db);
    const catKey = (c: CatSnap) => `${c.slug}|${c.name}|${c.sort_order}`;
    const recKey = (r: RecSnap) => `${r.slug}|${r.category_slug}|${r.sort_order}`;
    const catsOk =
      catsFinal.length === catsBefore.length &&
      new Set(catsFinal.map(catKey)).size === new Set([...catsBefore, ...catsFinal].map(catKey)).size &&
      catsBefore.every((c) => catsFinal.some((f) => catKey(f) === catKey(c)));
    const beforeRecKeys = new Set(recipesBefore.map(recKey));
    const recsOk =
      recsFinal.length === recipesBefore.length &&
      recsFinal.every((r) => beforeRecKeys.has(recKey(r)));
    check("RESTORE: categories match baseline", catsOk);
    check("RESTORE: recipes match baseline", recsOk);
  }

  console.log("─────────────────────────────────────────────");
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
