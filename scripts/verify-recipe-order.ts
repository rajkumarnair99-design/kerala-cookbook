/**
 * Read-only verification for Migration 006 (recipes.sort_order backfill).
 *
 * Confirms that, within every category, the recipes' sort_order values form
 * a dense 0..n-1 sequence — no NULLs, no gaps, no duplicates — and (as an
 * informational check) that the backfilled order is alphabetical by title.
 *
 * 100% read-only: it only runs SELECTs. Run it AFTER applying migration 006
 * in the Supabase SQL Editor:
 *
 *   npx tsx scripts/verify-recipe-order.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

type Category = { slug: string; name: string; sort_order: number };
type RecipeRow = {
  slug: string;
  title: string;
  category_slug: string;
  sort_order: number | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
    );
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: catData, error: catErr } = await supabase
    .from("categories")
    .select("slug, name, sort_order")
    .order("sort_order", { ascending: true });
  if (catErr) throw new Error(`categories: ${catErr.message}`);
  const categories = (catData ?? []) as unknown as Category[];

  const { data: recData, error: recErr } = await supabase
    .from("recipes")
    .select("slug, title, category_slug, sort_order");
  if (recErr) {
    if (/sort_order/.test(recErr.message)) {
      console.error(
        "recipes.sort_order column not found — has migration 006 been applied yet?",
      );
      process.exit(1);
    }
    throw new Error(`recipes: ${recErr.message}`);
  }
  const recipes = (recData ?? []) as unknown as RecipeRow[];

  // Group recipes by category.
  const byCat = new Map<string, RecipeRow[]>();
  for (const r of recipes) {
    const arr = byCat.get(r.category_slug) ?? [];
    arr.push(r);
    byCat.set(r.category_slug, arr);
  }

  const line = "─────────────────────────────────────────────";
  console.log("");
  console.log("Recipe Ordering — Migration 006 Backfill Verification");
  console.log(line);
  console.log(
    `Categories: ${categories.length}    Recipes: ${recipes.length}`,
  );
  console.log("");

  const issues: string[] = [];

  // Any recipe pointing at a category_slug with no matching categories row.
  const catSlugs = new Set(categories.map((c) => c.slug));
  for (const slug of byCat.keys()) {
    if (!catSlugs.has(slug)) {
      issues.push(`recipes reference unknown category_slug="${slug}"`);
    }
  }

  for (const c of categories) {
    const rows = byCat.get(c.slug) ?? [];
    const n = rows.length;
    const orders = rows.map((r) => r.sort_order);
    const nulls = orders.filter((o) => o === null).length;
    const nums = orders
      .filter((o): o is number => o !== null)
      .sort((a, b) => a - b);

    // Dense 0..n-1 ⇔ no nulls, count matches, and each index equals value.
    const dense =
      nulls === 0 && nums.length === n && nums.every((v, i) => v === i);

    // Detail for the failure report.
    const dupes = [
      ...new Set(nums.filter((v, i) => i > 0 && v === nums[i - 1])),
    ];
    const maxv = nums.length ? nums[nums.length - 1] : -1;

    // Informational: does the sort_order ordering match title A→Z (the
    // backfill's intent)? Not a failure if it drifts (the owner may reorder).
    const byOrder = rows
      .filter((r) => r.sort_order !== null)
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
    const alphaOk = byOrder.every(
      (r, i) => i === 0 || byOrder[i - 1].title.localeCompare(r.title) <= 0,
    );

    console.log(`  ${c.name} (${c.slug})`);
    console.log(
      `     recipes=${String(n).padStart(2)}   ` +
        `sort_order=${dense ? `dense 0..${n - 1}` : "NOT DENSE"}   ` +
        `${dense ? "[PASS]" : "[FAIL]"}`,
    );
    console.log(
      `     alphabetical backfill: ${alphaOk ? "yes" : "no (differs from title A→Z)"}   ${alphaOk ? "[ok]" : "[info]"}`,
    );

    if (!dense) {
      if (nulls) issues.push(`${c.slug}: ${nulls} recipe(s) with NULL sort_order`);
      if (dupes.length)
        issues.push(`${c.slug}: duplicate sort_order value(s) ${dupes.join(",")}`);
      if (nulls === 0 && maxv !== n - 1)
        issues.push(`${c.slug}: highest sort_order is ${maxv}, expected ${n - 1} (gap)`);
    }
  }

  console.log("");
  console.log(line);
  if (issues.length === 0) {
    console.log("OVERALL: PASS — every category has a dense 0..n-1 ordering.");
  } else {
    console.log(`OVERALL: FAIL — ${issues.length} issue(s):`);
    for (const i of issues) console.log(`  • ${i}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
