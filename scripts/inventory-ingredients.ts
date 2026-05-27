/**
 * One-off: enumerates the distribution of unit and section values across
 * every recipe_ingredients row. Used in Stage 2B Session 1 planning to
 * design the unit-normalization migration and the sections-as-first-class
 * migration.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pull every (unit, section) — the table is small enough to count in JS.
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("unit, section")
    .returns<{ unit: string | null; section: string | null }[]>();
  if (error) throw error;

  const rows = data ?? [];

  const unitCounts = new Map<string, number>();
  for (const r of rows) {
    const key = r.unit === null ? "(NULL)" : r.unit === "" ? "(EMPTY)" : r.unit;
    unitCounts.set(key, (unitCounts.get(key) ?? 0) + 1);
  }

  const sectionCounts = new Map<string, number>();
  for (const r of rows) {
    const key = r.section === null ? "(NULL — no section)" : r.section === "" ? "(EMPTY)" : r.section;
    sectionCounts.set(key, (sectionCounts.get(key) ?? 0) + 1);
  }

  console.log(`\nTotal ingredient rows: ${rows.length}\n`);

  console.log("UNIT DISTRIBUTION");
  console.log("─────────────────────────────────");
  console.log("unit value             count");
  for (const [unit, count] of [...unitCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${unit.padEnd(22)} ${count}`);
  }

  console.log("\nSECTION DISTRIBUTION");
  console.log("─────────────────────────────────");
  console.log("section name                                    count");
  for (const [section, count] of [...sectionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${section.padEnd(48)} ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
