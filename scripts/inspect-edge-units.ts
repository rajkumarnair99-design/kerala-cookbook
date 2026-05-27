/** One-off: dump rows whose unit doesn't map cleanly to the canonical list. */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const u of ["inch piece", "can"]) {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit, preparation, recipe_id")
      .eq("unit", u)
      .order("recipe_id");
    if (error) throw error;
    console.log(`\n${u.toUpperCase()}  (${data?.length} rows)`);
    console.log("─".repeat(70));
    for (const r of data ?? []) {
      console.log(
        `  qty="${r.quantity ?? ""}"  name="${r.name}"  prep="${r.preparation ?? ""}"`,
      );
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
