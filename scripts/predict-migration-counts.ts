/**
 * Predicts exactly how many rows each upcoming migration will touch,
 * so the operator has a number to verify against after running them.
 * Read-only — does not modify the database.
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

  async function scanAll<T>(): Promise<T[]> {
    const PAGE = 1000;
    const out: T[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, unit, section")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return out;
  }
  const all = await scanAll<{ recipe_id: number; unit: string | null; section: string | null }>();
  console.log(`Total ingredient rows: ${all.length}\n`);

  console.log("MIGRATION 003 — predicted row touches");
  console.log("─────────────────────────────────────────");

  // unit renames
  const unitMap: Record<string, string> = {
    cups: "cup",
    cloves: "clove",
    pinches: "pinch",
    sprigs: "sprig",
    bunches: "bunch",
    pieces: "piece",
    liter: "l",
    "inch piece": "(piece + qty rewrite)",
    can: "(qty rewrite)",
    cube: "(qty rewrite)",
  };
  let unitTouches = 0;
  for (const [from, to] of Object.entries(unitMap)) {
    const n = all.filter((r) => r.unit === from).length;
    console.log(`  unit "${from}" → "${to}":`.padEnd(48) + `${n} row(s)`);
    unitTouches += n;
  }
  console.log(`  TOTAL unit rewrites:`.padEnd(48) + `${unitTouches} row(s)`);

  // section renames
  const sectionMap: Record<string, string> = {
    "For seasoning": "For the seasoning",
    "Roasted masala": "For the roasted masala",
  };
  let secTouches = 0;
  for (const [from, to] of Object.entries(sectionMap)) {
    const n = all.filter((r) => r.section === from).length;
    console.log(`  section "${from}" → "${to}":`.padEnd(48) + `${n} row(s)`);
    secTouches += n;
  }
  console.log(`  TOTAL section rewrites:`.padEnd(48) + `${secTouches} row(s)`);

  // Rows touched by BOTH a unit rename AND a section rename.
  const unitRenames = new Set(Object.keys(unitMap));
  const sectionRenames = new Set(Object.keys(sectionMap));
  const overlap = all.filter(
    (r) =>
      r.unit !== null && unitRenames.has(r.unit) &&
      r.section !== null && sectionRenames.has(r.section),
  ).length;
  console.log(`  Rows touched by BOTH a unit + section rename:`.padEnd(48) + `${overlap} row(s)`);

  console.log("\nMIGRATION 004 — predicted inserts");
  console.log("─────────────────────────────────────────");

  // simulate migration 003 normalization first, then count what 004 would insert
  const normSection = (s: string | null) => {
    if (s === null || s === "") return null;
    if (s === "For seasoning") return "For the seasoning";
    if (s === "Roasted masala") return "For the roasted masala";
    return s;
  };
  const recipesWithUnsectioned = new Set<number>();
  const namedPairs = new Set<string>();
  for (const r of all) {
    const sec = normSection(r.section);
    if (sec === null) {
      recipesWithUnsectioned.add(r.recipe_id);
    } else {
      namedPairs.add(`${r.recipe_id}|${sec}`);
    }
  }
  const mainInserts = recipesWithUnsectioned.size;
  const namedInserts = namedPairs.size;
  console.log(`  "Main ingredients" sections inserted (one per recipe`);
  console.log(`     that has any currently-unsectioned ingredients):`.padEnd(48) + `${mainInserts} row(s)`);
  console.log(`  Named sections inserted (one per distinct`);
  console.log(`     (recipe, section) pair after normalization):`.padEnd(48) + `${namedInserts} row(s)`);
  console.log(`  TOTAL new rows in recipe_sections:`.padEnd(48) + `${mainInserts + namedInserts} row(s)`);

  console.log("\nMIGRATION 004 — predicted ingredient updates");
  console.log("─────────────────────────────────────────");
  const unsectionedIngs = all.filter((r) => normSection(r.section) === null).length;
  const namedIngs = all.filter((r) => normSection(r.section) !== null).length;
  console.log(`  Ingredients pointed at their recipe's Main section:`.padEnd(54) + `${unsectionedIngs} row(s)`);
  console.log(`  Ingredients pointed at a named section row:`.padEnd(54) + `${namedIngs} row(s)`);
  console.log(`  TOTAL section_id assignments:`.padEnd(54) + `${unsectionedIngs + namedIngs} row(s)`);
  console.log(`  (this MUST equal ${all.length} — every row must end up with a section_id)`);

  // Distinct recipes total
  const recipeIds = new Set(all.map((r) => r.recipe_id));
  console.log(`\n  Distinct recipes with at least one ingredient: ${recipeIds.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
