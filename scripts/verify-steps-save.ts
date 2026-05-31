/**
 * Steps photo-safety canary (Stage 2D).
 *
 * Proves that the Steps tab's edit operations (instruction edit, timer edit,
 * reorder, add step, delete step) never collaterally delete a *surviving*
 * step's photos, and never orphan a Storage object.
 *
 * Why this is safe to trust: save_recipe (migration-005) updates surviving
 * steps IN PLACE by id and never touches step_photos directly. The only way a
 * photo row disappears is ON DELETE CASCADE when its parent step row is
 * deleted. So the only photo-loss vector is deleting a step — which is why the
 * manual run only ever deletes a brand-new, photo-less step.
 *
 * This script is 100% READ-ONLY against the database and Storage. The only
 * mutation in the whole procedure is the user pressing "Save recipe" in the
 * editor between the snapshot and compare runs.
 *
 * Workflow (manual drive):
 *   1. npx tsx scripts/verify-steps-save.ts snapshot
 *      → captures Nadan Chicken Curry's steps + step_photos + Storage state to
 *        scripts/.snapshots/nadan-steps-before.json
 *   2. (Perform the edits in the editor and press "Save recipe")
 *   3. npx tsx scripts/verify-steps-save.ts compare
 *      → re-reads the DB + Storage and prints a PASS/FAIL report
 *   (compare can be run after each save; it always diffs against the baseline.)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SLUG = "nadan-chicken-curry";
const SNAPSHOT_PATH = join(
  process.cwd(),
  "scripts",
  ".snapshots",
  "nadan-steps-before.json",
);

type RecipeRow = {
  id: number;
  slug: string;
  title: string;
  updated_at: string;
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

/** A photo's url decomposed into its Storage coordinates. */
type StoragePath = { bucket: string; folder: string; name: string };

type Snapshot = {
  taken_at: string;
  recipe: RecipeRow;
  steps: Step[];
  photos: Photo[];
};

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Decompose a public Storage url into { bucket, folder, name }.
 *   …/storage/v1/object/public/recipe-photos/nadan-chicken-curry/step-01a.jpg
 *      → { bucket: "recipe-photos", folder: "nadan-chicken-curry",
 *          name: "step-01a.jpg" }
 * Returns null for any url that isn't a recognisable public-object url.
 */
function parseStoragePath(url: string): StoragePath | null {
  const marker = "/object/public/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const rest = decodeURIComponent(url.slice(at + marker.length));
  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) return null;
  const bucket = rest.slice(0, firstSlash);
  const objectPath = rest.slice(firstSlash + 1);
  const lastSlash = objectPath.lastIndexOf("/");
  const folder = lastSlash === -1 ? "" : objectPath.slice(0, lastSlash);
  const name = lastSlash === -1 ? objectPath : objectPath.slice(lastSlash + 1);
  if (!bucket || !name) return null;
  return { bucket, folder, name };
}

async function readDbState(supabase: SupabaseClient): Promise<Snapshot> {
  const { data: recipe, error: recipeErr } = await supabase
    .from("recipes")
    .select("id, slug, title, updated_at")
    .eq("slug", SLUG)
    .single<RecipeRow>();
  if (recipeErr || !recipe) {
    throw new Error(
      `Could not read recipes row for slug=${SLUG}: ${recipeErr?.message ?? "no row"}`,
    );
  }

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
    steps: steps ?? [],
    photos,
  };
}

type StorageResult = {
  /** Photos whose backing object is confirmed to exist. */
  presentIds: Set<number>;
  /** Photos referenced in the DB but with NO backing Storage object, or an
   *  unparseable url. These are orphaned references — a real problem. */
  orphans: { id: number; url: string; reason: string }[];
  /** How many distinct (bucket, folder) listings we performed. */
  foldersListed: number;
};

/**
 * For each photo, confirm its Storage object exists. We list each distinct
 * (bucket, folder) once and test membership — efficient and read-only.
 */
async function checkStorage(
  supabase: SupabaseClient,
  photos: Photo[],
): Promise<StorageResult> {
  const presentIds = new Set<number>();
  const orphans: { id: number; url: string; reason: string }[] = [];

  // Group photos by "bucket folder" so we list each folder just once.
  const byFolder = new Map<string, { path: StoragePath; photos: Photo[] }>();
  for (const p of photos) {
    const parsed = parseStoragePath(p.url);
    if (!parsed) {
      orphans.push({ id: p.id, url: p.url, reason: "unparseable url" });
      continue;
    }
    const key = `${parsed.bucket} ${parsed.folder}`;
    const bucketEntry = byFolder.get(key);
    if (bucketEntry) bucketEntry.photos.push(p);
    else byFolder.set(key, { path: parsed, photos: [p] });
  }

  for (const { path, photos: groupPhotos } of byFolder.values()) {
    const { data: objects, error } = await supabase.storage
      .from(path.bucket)
      .list(path.folder, { limit: 1000 });
    if (error) {
      for (const p of groupPhotos) {
        orphans.push({
          id: p.id,
          url: p.url,
          reason: `Storage list failed for ${path.bucket}/${path.folder}: ${error.message}`,
        });
      }
      continue;
    }
    const names = new Set((objects ?? []).map((o) => o.name));
    for (const p of groupPhotos) {
      const parsed = parseStoragePath(p.url)!;
      if (names.has(parsed.name)) presentIds.add(p.id);
      else
        orphans.push({
          id: p.id,
          url: p.url,
          reason: `no object "${parsed.name}" in ${path.bucket}/${path.folder}`,
        });
    }
  }

  return { presentIds, orphans, foldersListed: byFolder.size };
}

async function doSnapshot() {
  const supabase = getClient();
  const state = await readDbState(supabase);
  const storage = await checkStorage(supabase, state.photos);

  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(state, null, 2));

  const line = "─────────────────────────────────────────────";
  console.log("");
  console.log("Steps Photo-Safety Canary — BASELINE SNAPSHOT");
  console.log(line);
  console.log(`Recipe:        ${state.recipe.title} (${state.recipe.slug})`);
  console.log(`Steps:         ${state.steps.length}`);
  console.log(`Step photos:   ${state.photos.length}`);
  console.log(
    `Storage check: ${storage.presentIds.size}/${state.photos.length} objects confirmed present` +
      ` (${storage.foldersListed} folder listing${storage.foldersListed === 1 ? "" : "s"})`,
  );
  console.log("");

  if (storage.orphans.length > 0) {
    console.log("‼ STOP — PRE-EXISTING STORAGE PROBLEM DETECTED");
    console.log(
      `  ${storage.orphans.length} photo row(s) reference a Storage object that does not exist:`,
    );
    for (const o of storage.orphans)
      console.log(`   • photo id=${o.id}: ${o.reason}`);
    console.log("");
    console.log(
      "  The baseline was still written, but DO NOT run the canary edits until",
    );
    console.log(
      "  this is investigated — a missing-photo result would be ambiguous.",
    );
    console.log(line);
    process.exitCode = 1;
    return;
  }

  console.log("All photos confirmed present in Storage. No orphans.");
  console.log(`Baseline written → ${SNAPSHOT_PATH}`);
  console.log(line);
}

function tag(ok: boolean) {
  return ok ? "[PASS]" : "[FAIL]";
}

async function doCompare() {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(
      `No baseline found at ${SNAPSHOT_PATH}.\n` +
        `Run "npx tsx scripts/verify-steps-save.ts snapshot" first.`,
    );
    process.exit(1);
  }
  const before = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
  const supabase = getClient();
  const after = await readDbState(supabase);
  const storage = await checkStorage(supabase, after.photos);

  // ---- Steps ----
  const beforeStepIds = new Set(before.steps.map((s) => s.id));
  const afterStepIds = new Set(after.steps.map((s) => s.id));
  const missingSteps = before.steps.filter((s) => !afterStepIds.has(s.id));
  const addedSteps = after.steps.filter((s) => !beforeStepIds.has(s.id));
  const stepsLostOk = missingSteps.length === 0; // failure-critical

  // Content/position changes for surviving steps are INFORMATIONAL (expected
  // for the edited & reordered steps), never a failure.
  const beforeStepById = new Map(before.steps.map((s) => [s.id, s]));
  const editedSteps = after.steps
    .filter((s) => beforeStepById.has(s.id))
    .map((a) => ({ a, b: beforeStepById.get(a.id)! }))
    .filter(
      ({ a, b }) =>
        a.instruction !== b.instruction ||
        a.timer_minutes !== b.timer_minutes ||
        a.tip !== b.tip ||
        a.step_number !== b.step_number,
    );

  // ---- Photos (the core assertion) ----
  const afterPhotoById = new Map(after.photos.map((p) => [p.id, p]));
  const beforePhotoIds = new Set(before.photos.map((p) => p.id));
  const missingPhotos = before.photos.filter((p) => !afterPhotoById.has(p.id));
  const addedPhotos = after.photos.filter((p) => !beforePhotoIds.has(p.id));
  const photosLostOk = missingPhotos.length === 0; // failure-critical

  // Surviving photos must keep the same url + step_id.
  const changedPhotos = before.photos
    .filter((p) => afterPhotoById.has(p.id))
    .map((b) => ({ b, a: afterPhotoById.get(b.id)! }))
    .filter(({ a, b }) => a.url !== b.url || a.step_id !== b.step_id);
  const photosStableOk = changedPhotos.length === 0;

  // ---- Storage (orphan check on the CURRENT photos) ----
  const storageOk = storage.orphans.length === 0;

  // ---- Per-surviving-step photo grouping ----
  const beforePhotosByStep = new Map<number, Photo[]>();
  for (const p of before.photos) {
    const arr = beforePhotosByStep.get(p.step_id) ?? [];
    arr.push(p);
    beforePhotosByStep.set(p.step_id, arr);
  }

  // ---- Sanity: did a save actually run? ----
  const updatedMoved = before.recipe.updated_at !== after.recipe.updated_at;

  const line = "─────────────────────────────────────────────";
  console.log("");
  console.log("Steps Photo-Safety Canary — COMPARE");
  console.log(line);
  console.log(`Recipe: ${after.recipe.title}`);
  console.log("");

  console.log("STEPS");
  console.log(
    `  Count:                  ${before.steps.length} → ${after.steps.length}`,
  );
  console.log(
    `  No surviving step lost: ${stepsLostOk ? "yes          " : "NO — STEP LOST"}   ${tag(stepsLostOk)}`,
  );
  if (addedSteps.length)
    console.log(
      `  Added steps (info):     id=${addedSteps.map((s) => s.id).join(",")} (expected during the add phase)`,
    );
  if (editedSteps.length)
    console.log(
      `  Edited/reordered (info): ${editedSteps
        .map((e) => `id=${e.a.id}`)
        .join(", ")} (expected from the edit checklist)`,
    );
  console.log("");

  console.log("STEP PHOTOS");
  console.log(
    `  Count:                  ${before.photos.length} → ${after.photos.length}`,
  );
  console.log(
    `  No photo lost:          ${photosLostOk ? "yes          " : "NO — PHOTO LOST"}   ${tag(photosLostOk)}`,
  );
  console.log(
    `  Surviving url/step_id:  ${photosStableOk ? "unchanged    " : "CHANGED      "}   ${tag(photosStableOk)}`,
  );
  if (addedPhotos.length)
    console.log(
      `  Added photos (info):    id=${addedPhotos.map((p) => p.id).join(",")}`,
    );
  console.log("");

  console.log("PER-SURVIVING-STEP PHOTO INTEGRITY");
  for (const s of after.steps) {
    if (!beforeStepById.has(s.id)) continue; // added step — no baseline photos
    const baselinePhotos = beforePhotosByStep.get(s.id) ?? [];
    if (baselinePhotos.length === 0) continue; // step had no photos to track
    const survived = baselinePhotos.filter((p) => afterPhotoById.has(p.id));
    const ok = survived.length === baselinePhotos.length;
    console.log(
      `  step#${String(s.step_number).padStart(2)} (id=${s.id}): ` +
        `${survived.length}/${baselinePhotos.length} photos intact   ${tag(ok)}`,
    );
  }
  console.log("");

  console.log("STORAGE");
  console.log(
    `  Objects confirmed:      ${storage.presentIds.size}/${after.photos.length} present` +
      ` (${storage.foldersListed} folder listing${storage.foldersListed === 1 ? "" : "s"})`,
  );
  console.log(
    `  Orphaned references:    ${storageOk ? "none         " : `${storage.orphans.length} FOUND`}   ${tag(storageOk)}`,
  );
  console.log("");

  console.log("SANITY");
  console.log(
    `  recipe.updated_at:      ${updatedMoved ? "moved (a save ran)" : "unchanged (no save since baseline?)"}`,
  );
  console.log("");
  console.log(line);

  // ---- Verdict ----
  const issues: string[] = [];
  if (!stepsLostOk)
    issues.push(
      `surviving step(s) LOST: id=${missingSteps.map((s) => `${s.id} (#${s.step_number})`).join(", ")}`,
    );
  if (!photosLostOk)
    issues.push(
      `step photo(s) LOST: ` +
        missingPhotos
          .map((p) => `id=${p.id} (step_id=${p.step_id}, ${p.url})`)
          .join("; "),
    );
  if (!photosStableOk)
    issues.push(
      `surviving photo url/step_id changed: ` +
        changedPhotos
          .map(
            ({ a, b }) =>
              `id=${a.id} (step_id ${b.step_id}→${a.step_id}, url ${b.url === a.url ? "same" : "CHANGED"})`,
          )
          .join("; "),
    );
  if (!storageOk)
    issues.push(
      `orphaned Storage reference(s): ` +
        storage.orphans.map((o) => `id=${o.id} — ${o.reason}`).join("; "),
    );

  if (issues.length === 0) {
    console.log("OVERALL: PASS — no surviving step or photo was lost; no orphans.");
  } else {
    console.log("‼ OVERALL: FAIL — STOP. Photo-safety regression detected:");
    for (const issue of issues) console.log(`  • ${issue}`);
    console.log("");
    console.log(
      "  Do NOT continue editing. The 36-photo backup at",
    );
    console.log(
      "  ~/Desktop/kerala-cookbook-photo-backups/nadan-chicken-curry/ can restore lost files.",
    );
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
  console.error(
    "Usage: npx tsx scripts/verify-steps-save.ts <snapshot|compare>",
  );
  process.exit(1);
}
