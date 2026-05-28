/** READ-ONLY. Dumps specific Nadan Chicken Curry ingredient rows verbatim. */
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
    .from("recipes")
    .select("id, title")
    .eq("slug", "nadan-chicken-curry")
    .single();
  console.log(`Recipe: ${recipe!.title} (id=${recipe!.id})\n`);

  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("id, name, quantity, unit, preparation, section_id, sort_order")
    .eq("recipe_id", recipe!.id)
    .in("name", ["Garlic", "Mustard seeds"])
    .order("sort_order");
  if (error) throw error;

  for (const r of data ?? []) {
    console.log(`name        = ${JSON.stringify(r.name)}`);
    console.log(`  id          = ${r.id}`);
    console.log(`  quantity    = ${JSON.stringify(r.quantity)}`);
    console.log(`  unit        = ${JSON.stringify(r.unit)}`);
    console.log(`  preparation = ${JSON.stringify(r.preparation)}`);
    console.log(`  section_id  = ${r.section_id}`);
    console.log("");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
