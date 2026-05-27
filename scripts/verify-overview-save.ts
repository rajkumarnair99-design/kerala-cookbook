/**
 * Save-safety check (started in Stage 2A Step 3, extended in Stage 2B
 * Session 1 to include sections). The filename stays as
 * verify-overview-save.ts for muscle-memory consistency.
 *
 * Verifies that saving a recipe through the editor only touches the
 * scoped fields and never destroys or rewrites ingredients, sections,
 * steps, step photos, or the hero image without intent.
 *
 * Workflow:
 *   1. npx tsx scripts/verify-overview-save.ts snapshot
 *      → captures the full Nadan Chicken Curry state to
 *        scripts/.snapshots/nadan-before.json
 *   2. (Press "Save recipe" in the editor)
 *   3. npx tsx scripts/verify-overview-save.ts compare
 *      → re-reads the database and prints a PASS/FAIL report
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SLUG = "nadan-chicken-curry";
const SNAPSHOT_PATH = join(
  process.cwd(),
  "scripts",
  ".snapshots",
  "nadan-before.json",
);

type Recipe = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  category_slug: string;
  serves: string | null;
  tags: string[];
  source: string | null;
  notes: string | null;
  story: string | null;
  author: string | null;
  hero_image_url: string | null;
  is_public: boolean;
  video_url: string | null;
  created_at: string;
  updated_at: string;
};

type Section = {
  id: number;
  name: string;
  sort_order: number;
  collapsed: boolean;
};

type Ingredient = {
  id: number;
  section_id: number;
  section: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
  sort_order: number;
};

type Step = {
  id: number;
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  tip: string | null;
};

type Photo = {
  id: number;
  step_id: number;
  url: string;
  sort_order: number;
};

type Snapshot = {
  taken_at: string;
  recipe: Recipe;
  sections: Section[];
  ingredients: Ingredient[];
  steps: Step[];
  photos: Photo[];
};

async function readState(): Promise<Snapshot> {
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

  const { data: recipe, error: recipeErr } = await supabase
    .from("recipes")
    .select("*")
    .eq("slug", SLUG)
    .single<Recipe>();
  if (recipeErr || !recipe) {
    throw new Error(
      `Could not read recipes row for slug=${SLUG}: ${recipeErr?.message ?? "no row"}`,
    );
  }

  const { data: sections, error: secErr } = await supabase
    .from("recipe_sections")
    .select("id, name, sort_order, collapsed")
    .eq("recipe_id", recipe.id)
    .order("sort_order", { ascending: true })
    .returns<Section[]>();
  if (secErr) throw new Error(`recipe_sections: ${secErr.message}`);

  const { data: ingredients, error: ingErr } = await supabase
    .from("recipe_ingredients")
    .select(
      "id, section_id, section, name, quantity, unit, preparation, optional, sort_order",
    )
    .eq("recipe_id", recipe.id)
    .order("sort_order", { ascending: true })
    .returns<Ingredient[]>();
  if (ingErr) throw new Error(`recipe_ingredients: ${ingErr.message}`);

  const { data: steps, error: stepErr } = await supabase
    .from("recipe_steps")
    .select("id, step_number, instruction, timer_minutes, tip")
    .eq("recipe_id", recipe.id)
    .order("step_number", { ascending: true })
    .returns<Step[]>();
  if (stepErr) throw new Error(`recipe_steps: ${stepErr.message}`);

  const stepIds = (steps ?? []).map((s) => s.id);
  let photos: Photo[] = [];
  if (stepIds.length > 0) {
    const { data: photoRows, error: photoErr } = await supabase
      .from("step_photos")
      .select("id, step_id, url, sort_order")
      .in("step_id", stepIds)
      .order("step_id", { ascending: true })
      .order("sort_order", { ascending: true })
      .returns<Photo[]>();
    if (photoErr) throw new Error(`step_photos: ${photoErr.message}`);
    photos = photoRows ?? [];
  }

  return {
    taken_at: new Date().toISOString(),
    recipe,
    sections: sections ?? [],
    ingredients: ingredients ?? [],
    steps: steps ?? [],
    photos,
  };
}

async function doSnapshot() {
  const state = await readState();
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(state, null, 2));
  console.log(
    `Snapshot saved: ${state.sections.length} sections, ` +
      `${state.ingredients.length} ingredients, ` +
      `${state.steps.length} steps, ${state.photos.length} photos, ` +
      `hero=${state.recipe.hero_image_url ? "yes" : "no"}`,
  );
  console.log(`→ ${SNAPSHOT_PATH}`);
}

/** Sort + JSON.stringify a row so we can diff two snapshots by string equality. */
function stableRow<T extends Record<string, unknown>>(row: T): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(row).sort()) sorted[key] = row[key];
  return JSON.stringify(sorted);
}

function diffById<T extends { id: number }>(
  before: T[],
  after: T[],
): {
  missing: number[];
  added: number[];
  changed: { id: number; before: T; after: T }[];
} {
  const beforeMap = new Map(before.map((r) => [r.id, r]));
  const afterMap = new Map(after.map((r) => [r.id, r]));
  const missing: number[] = [];
  const changed: { id: number; before: T; after: T }[] = [];
  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) missing.push(id);
    else if (stableRow(b) !== stableRow(a)) changed.push({ id, before: b, after: a });
  }
  const added: number[] = [];
  for (const id of afterMap.keys()) if (!beforeMap.has(id)) added.push(id);
  return { missing, added, changed };
}

function tag(ok: boolean) {
  return ok ? "[PASS]" : "[FAIL]";
}

async function doCompare() {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(
      `No snapshot found at ${SNAPSHOT_PATH}.\n` +
        `Run "npx tsx scripts/verify-overview-save.ts snapshot" first.`,
    );
    process.exit(1);
  }
  const before = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
  const after = await readState();

  // --- Sections (new in 2B/S1) ---
  const secCountOk = before.sections.length === after.sections.length;
  const secDiff = diffById(before.sections, after.sections);
  const secIdsOk = secDiff.missing.length === 0 && secDiff.added.length === 0;
  const secContentOk = secDiff.changed.length === 0;

  // --- Ingredients ---
  const ingCountOk = before.ingredients.length === after.ingredients.length;
  const ingDiff = diffById(before.ingredients, after.ingredients);
  const ingIdsOk = ingDiff.missing.length === 0 && ingDiff.added.length === 0;
  const ingContentOk = ingDiff.changed.length === 0;
  // Section-assignment check: same ingredient id → same section_id.
  const ingSectionsOk =
    ingDiff.changed.filter((c) => c.before.section_id !== c.after.section_id)
      .length === 0;

  // --- Steps ---
  const stepCountOk = before.steps.length === after.steps.length;
  const stepDiff = diffById(before.steps, after.steps);
  const stepIdsOk = stepDiff.missing.length === 0 && stepDiff.added.length === 0;
  const stepContentOk = stepDiff.changed.length === 0;

  // --- Photos ---
  const photoCountOk = before.photos.length === after.photos.length;
  const photoDiff = diffById(before.photos, after.photos);
  const photoIdsOk = photoDiff.missing.length === 0 && photoDiff.added.length === 0;
  const photoUrlsOk =
    photoDiff.changed.filter((c) => c.before.url !== c.after.url).length === 0;

  // --- Recipe-level fields ---
  const heroSame = before.recipe.hero_image_url === after.recipe.hero_image_url;
  const notesSame = (before.recipe.notes ?? "") === (after.recipe.notes ?? "");
  const storySame = (before.recipe.story ?? "") === (after.recipe.story ?? "");
  const updatedMoved = before.recipe.updated_at !== after.recipe.updated_at;

  const line = "─────────────────────────────────────────────";
  console.log("");
  console.log("Save Safety Check");
  console.log(line);
  console.log(`Recipe: ${after.recipe.title}`);
  console.log("");

  console.log("SECTIONS");
  console.log(
    `  Count:                  ${before.sections.length} → ${after.sections.length}         ${tag(secCountOk)}`,
  );
  console.log(`  IDs:                    ${secIdsOk ? "all preserved" : "CHANGED      "}   ${tag(secIdsOk)}`);
  console.log(`  Content:                ${secContentOk ? "unchanged    " : "CHANGED      "}   ${tag(secContentOk)}`);
  console.log("");

  console.log("INGREDIENTS");
  console.log(
    `  Count:                  ${before.ingredients.length} → ${after.ingredients.length}         ${tag(ingCountOk)}`,
  );
  console.log(`  IDs:                    ${ingIdsOk ? "all preserved" : "CHANGED      "}   ${tag(ingIdsOk)}`);
  console.log(`  Content:                ${ingContentOk ? "unchanged    " : "CHANGED      "}   ${tag(ingContentOk)}`);
  console.log(`  section_id assignments: ${ingSectionsOk ? "unchanged    " : "CHANGED      "}   ${tag(ingSectionsOk)}`);
  console.log("");

  console.log("STEPS");
  console.log(
    `  Count:                  ${before.steps.length} → ${after.steps.length}         ${tag(stepCountOk)}`,
  );
  console.log(`  IDs:                    ${stepIdsOk ? "all preserved" : "CHANGED      "}   ${tag(stepIdsOk)}`);
  console.log(`  Content:                ${stepContentOk ? "unchanged    " : "CHANGED      "}   ${tag(stepContentOk)}`);
  console.log("");

  console.log("STEP PHOTOS");
  console.log(
    `  Count:                  ${before.photos.length} → ${after.photos.length}         ${tag(photoCountOk)}`,
  );
  console.log(`  IDs:                    ${photoIdsOk ? "all preserved" : "CHANGED      "}   ${tag(photoIdsOk)}`);
  console.log(`  URLs:                   ${photoUrlsOk ? "unchanged    " : "CHANGED      "}   ${tag(photoUrlsOk)}`);
  console.log("");

  console.log("RECIPE-LEVEL FIELDS");
  console.log(`  hero_image_url: ${heroSame ? "unchanged" : "CHANGED  "}  ${tag(heroSame)}`);
  console.log(`  notes:          ${notesSame ? "unchanged" : "CHANGED  "}  ${tag(notesSame)}`);
  console.log(
    `  story:          ${storySame ? "unchanged" : "changed  "}  ${storySame ? "[unchanged]" : "[EXPECTED if you edited it]"}`,
  );
  console.log(
    `  updated_at:     ${updatedMoved ? "moved    " : "unchanged"}  ${updatedMoved ? "[EXPECTED]" : "[FAIL — save did not run?]"}`,
  );
  console.log("");
  console.log(line);

  const issues: string[] = [];
  if (!secCountOk) issues.push(`section count changed (${before.sections.length} → ${after.sections.length})`);
  if (!secIdsOk) {
    if (secDiff.missing.length) issues.push(`sections deleted: id=${secDiff.missing.join(",")}`);
    if (secDiff.added.length) issues.push(`sections inserted: id=${secDiff.added.join(",")}`);
  }
  if (!secContentOk) {
    issues.push(`sections content changed for id=${secDiff.changed.map((c) => c.id).join(",")}`);
  }

  if (!ingCountOk) issues.push(`ingredient count changed (${before.ingredients.length} → ${after.ingredients.length})`);
  if (!ingIdsOk) {
    if (ingDiff.missing.length) issues.push(`ingredients deleted: id=${ingDiff.missing.join(",")}`);
    if (ingDiff.added.length) issues.push(`ingredients inserted: id=${ingDiff.added.join(",")}`);
  }
  if (!ingContentOk) {
    issues.push(`ingredients content changed for id=${ingDiff.changed.map((c) => c.id).join(",")}`);
  }
  if (!ingSectionsOk) {
    const moved = ingDiff.changed.filter((c) => c.before.section_id !== c.after.section_id);
    issues.push(
      `ingredient section_id reassigned: ` +
        moved.map((c) => `id=${c.id} (${c.before.section_id} → ${c.after.section_id})`).join("; "),
    );
  }

  if (!stepCountOk) issues.push(`step count changed (${before.steps.length} → ${after.steps.length})`);
  if (!stepIdsOk) {
    if (stepDiff.missing.length) issues.push(`steps deleted: id=${stepDiff.missing.join(",")}`);
    if (stepDiff.added.length) issues.push(`steps inserted: id=${stepDiff.added.join(",")}`);
  }
  if (!stepContentOk) {
    issues.push(`steps content changed for id=${stepDiff.changed.map((c) => c.id).join(",")}`);
  }

  if (!photoCountOk) issues.push(`photo count changed (${before.photos.length} → ${after.photos.length})`);
  if (!photoIdsOk) {
    if (photoDiff.missing.length) issues.push(`photos deleted: id=${photoDiff.missing.join(",")}`);
    if (photoDiff.added.length) issues.push(`photos inserted: id=${photoDiff.added.join(",")}`);
  }
  if (!photoUrlsOk) {
    const changedPhotos = photoDiff.changed.filter((c) => c.before.url !== c.after.url);
    issues.push(
      `photo URLs changed: ` +
        changedPhotos.map((c) => `id=${c.id} (${c.before.url} → ${c.after.url})`).join("; "),
    );
  }

  if (!heroSame) {
    issues.push(`hero_image_url changed: ${before.recipe.hero_image_url} → ${after.recipe.hero_image_url}`);
  }
  if (!notesSame) {
    issues.push(`notes changed (Overview tab must NOT touch notes)`);
  }
  if (!updatedMoved) {
    issues.push(`updated_at did not change — did the save actually run?`);
  }

  if (issues.length === 0) {
    console.log("OVERALL: PASS");
  } else {
    console.log(`OVERALL: FAIL — ${issues.length} issue(s)`);
    for (const issue of issues) console.log(`  • ${issue}`);
    process.exitCode = 1;
  }
}

const mode = process.argv[2];
if (mode === "snapshot") {
  doSnapshot().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (mode === "compare") {
  doCompare().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.error("Usage: npx tsx scripts/verify-overview-save.ts <snapshot|compare>");
  process.exit(1);
}
