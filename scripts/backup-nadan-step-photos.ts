/**
 * One-time safety backup of Nadan Chicken Curry's step photos — the actual
 * image FILES, not just database references. These are irreplaceable Stage 1
 * photography.
 *
 * Downloads every step photo to:
 *   ~/Desktop/kerala-cookbook-photo-backups/nadan-chicken-curry/
 * named step-NN-photo-MM.<ext>, plus a manifest.json mapping each file to its
 * step number, instruction, and original URL.
 *
 * READ-ONLY against the database and Storage — it only reads + downloads.
 *
 *   npx tsx scripts/backup-nadan-step-photos.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SLUG = "nadan-chicken-curry";
const OUT_DIR = join(homedir(), "Desktop", "kerala-cookbook-photo-backups", SLUG);

type PhotoRow = { url: string; sort_order: number };
type StepRow = {
  step_number: number;
  instruction: string;
  step_photos: PhotoRow[] | null;
};

function extFromUrl(url: string): string {
  const clean = url.split("?")[0];
  const dot = clean.lastIndexOf(".");
  const ext = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "jpg";
  // Guard against a path with no real extension.
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: recipe, error: rErr } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("slug", SLUG)
    .single();
  if (rErr || !recipe) throw rErr ?? new Error("recipe not found");

  const { data: steps, error: sErr } = await supabase
    .from("recipe_steps")
    .select("step_number, instruction, step_photos ( url, sort_order )")
    .eq("recipe_id", recipe.id)
    .order("step_number")
    .returns<StepRow[]>();
  if (sErr) throw sErr;

  mkdirSync(OUT_DIR, { recursive: true });

  const manifest: {
    step_number: number;
    instruction: string;
    original_url: string;
    local_filename: string;
  }[] = [];

  let downloaded = 0;
  let stepsWithPhotos = 0;

  for (const step of steps ?? []) {
    const photos = (step.step_photos ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    if (photos.length) stepsWithPhotos += 1;

    let photoIndex = 0;
    for (const photo of photos) {
      photoIndex += 1;
      const filename = `step-${pad(step.step_number)}-photo-${pad(photoIndex)}.${extFromUrl(photo.url)}`;

      const resp = await fetch(photo.url);
      if (!resp.ok) {
        throw new Error(
          `Failed to download ${photo.url} — HTTP ${resp.status}. Aborting so the backup is not silently incomplete.`,
        );
      }
      const bytes = Buffer.from(await resp.arrayBuffer());
      writeFileSync(join(OUT_DIR, filename), bytes);
      downloaded += 1;

      manifest.push({
        step_number: step.step_number,
        instruction: (step.instruction ?? "").slice(0, 60),
        original_url: photo.url,
        local_filename: filename,
      });
      console.log(`  ✓ ${filename}  (${(bytes.length / 1024).toFixed(0)} KB)`);
    }
  }

  writeFileSync(
    join(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        recipe: recipe.title,
        slug: SLUG,
        backed_up_at: new Date().toISOString(),
        total_photos: downloaded,
        steps_with_photos: stepsWithPhotos,
        photos: manifest,
      },
      null,
      2,
    ),
  );

  console.log(
    `\nBacked up ${downloaded} photos across ${stepsWithPhotos} steps to ${OUT_DIR}`,
  );
  console.log(`Manifest: ${join(OUT_DIR, "manifest.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
