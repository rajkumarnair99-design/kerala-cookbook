/**
 * scripts/upload-photos.ts
 *
 * Uploads the Nadan Chicken Curry step photos into Supabase Storage,
 * then re-points the step_photos table rows at their new Storage URLs.
 *
 * Run with:  npx tsx scripts/upload-photos.ts
 *
 * Safe to re-run: uploads overwrite (upsert), and the database update is
 * idempotent — photo rows are matched by filename whether their URL is
 * the old local path or the new Storage URL.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(rootDir, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

// The secret key bypasses Row Level Security and grants Storage admin rights.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const BUCKET = "recipe-photos";
const RECIPE_SLUG = "nadan-chicken-curry";
const PHOTO_DIR = join(rootDir, "public", "recipe-images", RECIPE_SLUG);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function bail(message: string, error: unknown): never {
  console.error(`\n❌ ${message}`);
  console.error(error);
  process.exit(1);
}

function contentTypeFor(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function main() {
  // 1. Ensure a public Storage bucket exists.
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) {
    console.log(`Bucket "${BUCKET}" already exists — confirming it is public.`);
    const { error } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
    });
    if (error) bail(`Could not confirm "${BUCKET}" is public.`, error);
  } else {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
    });
    if (error) bail(`Could not create bucket "${BUCKET}".`, error);
    console.log(`✓ Created public bucket "${BUCKET}".`);
  }

  // 2. Collect the image files (ignores README.md and any non-images).
  const files = readdirSync(PHOTO_DIR)
    .filter((name) => IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort();
  console.log(`Found ${files.length} photo files in ${RECIPE_SLUG}/.`);

  // 3. Upload each file, preserving its filename, under a recipe folder.
  const publicUrlByFilename = new Map<string, string>();
  for (const filename of files) {
    const objectPath = `${RECIPE_SLUG}/${filename}`;
    const buffer = readFileSync(join(PHOTO_DIR, filename));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, {
        contentType: contentTypeFor(filename),
        upsert: true,
      });
    if (error) bail(`Failed uploading "${filename}".`, error);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    publicUrlByFilename.set(filename, data.publicUrl);
    console.log(`  uploaded ${objectPath}`);
  }

  // 4. Re-point the step_photos rows for this recipe at the Storage URLs.
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("slug", RECIPE_SLUG)
    .single();
  if (recipeError || !recipe) {
    bail(`Could not find recipe "${RECIPE_SLUG}".`, recipeError);
  }

  const { data: steps, error: stepsError } = await supabase
    .from("recipe_steps")
    .select("id")
    .eq("recipe_id", recipe.id);
  if (stepsError || !steps) bail("Could not read recipe_steps.", stepsError);
  const stepIds = steps.map((step) => step.id as number);

  const { data: photos, error: photosError } = await supabase
    .from("step_photos")
    .select("id, url")
    .in("step_id", stepIds);
  if (photosError || !photos) bail("Could not read step_photos.", photosError);

  let updated = 0;
  for (const photo of photos) {
    const filename = String(photo.url).split("/").pop() ?? "";
    const newUrl = publicUrlByFilename.get(filename);
    if (!newUrl) {
      console.warn(
        `  ⚠ no uploaded file matches step_photos row ${photo.id} (${photo.url})`,
      );
      continue;
    }
    if (photo.url === newUrl) continue; // already pointing at Storage
    const { error } = await supabase
      .from("step_photos")
      .update({ url: newUrl })
      .eq("id", photo.id);
    if (error) bail(`Failed updating step_photos row ${photo.id}.`, error);
    updated += 1;
  }

  // 5. Report and verify.
  console.log(`\n✓ Uploaded ${files.length} photos to bucket "${BUCKET}".`);
  console.log(`✓ Updated ${updated} step_photos row(s) to Storage URLs.`);

  const { data: afterPhotos, error: afterError } = await supabase
    .from("step_photos")
    .select("url")
    .in("step_id", stepIds);
  if (afterError) bail("Could not re-read step_photos to verify.", afterError);
  const localLeft = (afterPhotos ?? []).filter((p) =>
    String(p.url).startsWith("/recipe-images"),
  ).length;
  console.log(
    `✓ step_photos rows still pointing at old /recipe-images paths: ` +
      `${localLeft} (must be 0)`,
  );
  console.log(`\nExample new URL:\n  ${[...publicUrlByFilename.values()][0]}`);

  if (localLeft > 0) {
    console.error("\n❌ Some photo rows were not updated. Please review above.");
    process.exit(1);
  }
  console.log("\n✅ Done.");
}

main().catch((err) => bail("Unexpected error.", err));
