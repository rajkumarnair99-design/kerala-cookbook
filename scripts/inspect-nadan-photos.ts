/** READ-ONLY. Enumerates Nadan Chicken Curry step photos + their storage paths. */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: recipe } = await supabase
    .from("recipes").select("id, title").eq("slug", "nadan-chicken-curry").single();

  const { data: steps } = await supabase
    .from("recipe_steps")
    .select("id, step_number, step_photos ( id, url, sort_order )")
    .eq("recipe_id", recipe!.id)
    .order("step_number");

  let photoCount = 0;
  let stepsWithPhotos = 0;
  const sampleUrls: string[] = [];
  for (const s of steps ?? []) {
    const photos = (s as { step_photos?: { url: string }[] }).step_photos ?? [];
    if (photos.length) stepsWithPhotos += 1;
    photoCount += photos.length;
    if (sampleUrls.length < 3) for (const p of photos) if (sampleUrls.length < 3) sampleUrls.push(p.url);
  }

  console.log(`Recipe: ${recipe!.title} (id=${recipe!.id})`);
  console.log(`Steps: ${steps?.length}  |  Steps with photos: ${stepsWithPhotos}  |  Total photos: ${photoCount}\n`);
  console.log("Sample URLs:");
  for (const u of sampleUrls) console.log("  " + u);

  // Derive bucket + path from a public Storage URL of the form
  // https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
  if (sampleUrls[0]) {
    const m = sampleUrls[0].match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (m) console.log(`\nBucket: ${m[1]}\nExample object path: ${m[2]}`);
    else console.log("\n(URL does not match the standard Supabase public-object pattern)");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
