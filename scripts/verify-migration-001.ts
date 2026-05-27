/**
 * scripts/verify-migration-001.ts
 *
 * Read-only verification that migration-001-hero-image-url.sql has been
 * applied to Supabase: the hero_image_url column exists on recipes and
 * Nadan Chicken Curry is intact (hero_image_url is NULL, ingredients /
 * steps / step-photos counts unchanged, story + notes still present).
 *
 * Does NOT call save_recipe — Step 3 covers the save-roundtrip test.
 *
 * Run with:  npx tsx scripts/verify-migration-001.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(rootDir, ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}
const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const SLUG = "nadan-chicken-curry";

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const pass = (name: string, detail = "") =>
  checks.push({ name, pass: true, detail });
const fail = (name: string, detail: string) =>
  checks.push({ name, pass: false, detail });

async function countWhere(table: string, recipeId: number) {
  const r = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("recipe_id", recipeId);
  if (r.error) throw r.error;
  return r.count ?? 0;
}

async function main() {
  // 1. Read recipe row including the new column.
  const r = await supabase
    .from("recipes")
    .select("id, slug, title, story, notes, hero_image_url")
    .eq("slug", SLUG)
    .maybeSingle();

  if (r.error) {
    fail("Read recipes row (column may be missing)", r.error.message);
  } else if (!r.data) {
    fail("Recipe exists", `slug '${SLUG}' not found`);
  } else {
    pass("Recipe loaded", `id=${r.data.id}`);

    if ("hero_image_url" in r.data) {
      pass("hero_image_url column present", "selected without SQL error");
    } else {
      fail("hero_image_url column present", "column missing from row");
    }

    if (r.data.hero_image_url === null) {
      pass("hero_image_url value is NULL", "null");
    } else {
      fail("hero_image_url value is NULL", `got: ${r.data.hero_image_url}`);
    }

    if (r.data.title === "Nadan Chicken Curry") {
      pass("Title intact", r.data.title);
    } else {
      fail("Title intact", `got: ${r.data.title}`);
    }

    // Story / notes "intact" = column readable, type still string-or-null.
    // We don't require content (Nadan was never given a story).
    const storyOk = r.data.story === null || typeof r.data.story === "string";
    if (storyOk) {
      const detail =
        r.data.story === null
          ? "null (no story set)"
          : `${(r.data.story as string).length} chars`;
      pass("Story column intact", detail);
    } else {
      fail("Story column intact", `unexpected type: ${typeof r.data.story}`);
    }

    const notesOk = r.data.notes === null || typeof r.data.notes === "string";
    if (notesOk) {
      const detail =
        r.data.notes === null
          ? "null"
          : `${(r.data.notes as string).length} chars`;
      pass("Notes column intact", detail);
    } else {
      fail("Notes column intact", `unexpected type: ${typeof r.data.notes}`);
    }

    const recipeId = r.data.id as number;

    const ingCount = await countWhere("recipe_ingredients", recipeId);
    if (ingCount === 22) {
      pass("Ingredient count = 22", `count=${ingCount}`);
    } else {
      fail("Ingredient count = 22", `got: ${ingCount}`);
    }

    const stepCount = await countWhere("recipe_steps", recipeId);
    if (stepCount === 20) {
      pass("Step count = 20", `count=${stepCount}`);
    } else {
      fail("Step count = 20", `got: ${stepCount}`);
    }

    // step_photos is keyed by step_id, not recipe_id — fetch step ids first.
    const stepRows = await supabase
      .from("recipe_steps")
      .select("id")
      .eq("recipe_id", recipeId);
    if (stepRows.error) throw stepRows.error;
    const stepIds = (stepRows.data ?? []).map((s) => s.id as number);
    const photos = await supabase
      .from("step_photos")
      .select("*", { count: "exact", head: true })
      .in("step_id", stepIds);
    if (photos.error) throw photos.error;
    const photoCount = photos.count ?? 0;
    if (photoCount === 36) {
      pass("Step photo count = 36", `count=${photoCount}`);
    } else {
      fail("Step photo count = 36", `got: ${photoCount}`);
    }
  }

  // Report
  const w = Math.max(...checks.map((c) => c.name.length)) + 2;
  console.log("\nVerification — migration-001 (hero_image_url):\n");
  for (const c of checks) {
    const tick = c.pass ? "✓" : "✗";
    console.log(`  ${tick}  ${c.name.padEnd(w)}  ${c.detail}`);
  }
  console.log();
  const failed = checks.filter((c) => !c.pass).length;
  if (failed === 0) {
    console.log("All checks passed.");
  } else {
    console.log(`${failed} check(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
