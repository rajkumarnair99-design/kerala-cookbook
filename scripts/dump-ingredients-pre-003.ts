/**
 * Pre-Migration-003 safety snapshot. Dumps every row of recipe_ingredients
 * (every column) to a JSON file, so the unit/quantity/section text rewrites
 * in Migration 003 can be reversed cell-by-cell if anything goes wrong.
 *
 * Pages through the table — does NOT rely on supabase-js's default 1000-
 * row range (Stage 2B Session 1 inventory taught us that lesson).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const OUT = join(
  process.cwd(),
  "scripts",
  ".snapshots",
  "recipe_ingredients-pre-migration-003.json",
);
const PAGE = 1000;

type Row = {
  id: number;
  recipe_id: number;
  section: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
  sort_order: number;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
    );
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authoritative count via head/count (not affected by row range).
  const { count, error: countErr } = await supabase
    .from("recipe_ingredients")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;

  // Page through every row, ordered by id so the dump is stable and
  // re-runnable. Selecting "*" pulls every column without us having to
  // enumerate them — survives future column additions automatically.
  const all: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<Row[]>();
    if (error) throw error;
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }

  if (all.length !== count) {
    throw new Error(
      `Page scan returned ${all.length} rows but COUNT(*) reported ${count}. Aborting — would not produce a complete snapshot.`,
    );
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        taken_at: new Date().toISOString(),
        row_count: all.length,
        rows: all,
      },
      null,
      2,
    ),
  );

  console.log(`Saved ${all.length} rows to ${OUT}`);

  // Unit-value distribution — for cross-checking against Migration 003's
  // predicted rewrites (cups=42, cloves=16, inch piece=31, etc).
  const tally = new Map<string, number>();
  for (const r of all) {
    const k = r.unit === null ? "(NULL)" : r.unit === "" ? "(EMPTY)" : r.unit;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  console.log("\nUnit-value distribution (snapshot — cross-check vs Migration 003 predictions):");
  console.log("─────────────────────────────────");
  for (const [u, c] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${u.padEnd(22)} ${c}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
