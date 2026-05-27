/**
 * One-off: verify the actual ingredient row count, and dump full context
 * for the two ingredients whose section value is "Rasam" / "Koottu Curry".
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

  // 1. Authoritative count via head/count (not affected by row range).
  const { count, error: countErr } = await supabase
    .from("recipe_ingredients")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;
  console.log(`\nrecipe_ingredients TOTAL row count: ${count}`);

  // 2. Re-run distinct unit / section distributions using paged scan,
  //    so we are NOT capped at supabase-js's default 1000-row limit.
  async function scanAll<T>(table: string, cols: string): Promise<T[]> {
    const PAGE = 1000;
    const out: T[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(cols)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return out;
  }

  const all = await scanAll<{ unit: string | null; section: string | null }>(
    "recipe_ingredients",
    "unit, section",
  );
  console.log(`(paged scan returned ${all.length} rows)`);

  const tally = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const v of arr) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const unitKey = (u: string | null) =>
    u === null ? "(NULL)" : u === "" ? "(EMPTY)" : u;
  const secKey = (s: string | null) =>
    s === null ? "(NULL — no section)" : s === "" ? "(EMPTY)" : s;

  console.log("\nUNIT DISTRIBUTION (true totals)");
  console.log("─────────────────────────────────");
  for (const [u, c] of tally(all.map((r) => unitKey(r.unit)))) {
    console.log(`${u.padEnd(22)} ${c}`);
  }

  console.log("\nSECTION DISTRIBUTION (true totals)");
  console.log("─────────────────────────────────");
  for (const [s, c] of tally(all.map((r) => secKey(r.section)))) {
    console.log(`${s.padEnd(48)} ${c}`);
  }

  // 3. For each flagged section, dump the row + all recipe-mates grouped
  //    by section, so we can see the data-entry pattern in context.
  for (const target of ["Rasam", "Koottu Curry"]) {
    console.log(`\n${"═".repeat(72)}`);
    console.log(`FLAGGED SECTION: "${target}"`);
    console.log("═".repeat(72));

    const { data: hits, error: hitErr } = await supabase
      .from("recipe_ingredients")
      .select("id, recipe_id, name, quantity, unit, preparation, section, sort_order")
      .eq("section", target);
    if (hitErr) throw hitErr;

    for (const row of hits ?? []) {
      const { data: recipe, error: rErr } = await supabase
        .from("recipes")
        .select("title, slug")
        .eq("id", row.recipe_id)
        .single();
      if (rErr) throw rErr;

      console.log(`\nParent recipe: "${recipe.title}"  (slug: ${recipe.slug})`);
      console.log("");
      console.log("  The flagged ingredient row:");
      console.log(
        `    name="${row.name}"  qty="${row.quantity ?? ""}"  unit="${row.unit ?? ""}"  prep="${row.preparation ?? ""}"  sort_order=${row.sort_order}`,
      );

      console.log("");
      console.log(`  ALL ingredients in "${recipe.title}", grouped by section:`);

      const { data: mates, error: mErr } = await supabase
        .from("recipe_ingredients")
        .select("name, quantity, unit, preparation, section, sort_order")
        .eq("recipe_id", row.recipe_id)
        .order("sort_order");
      if (mErr) throw mErr;

      const bySection = new Map<string, typeof mates>();
      for (const m of mates ?? []) {
        const k = m.section === null ? "(no section)" : m.section === "" ? "(empty)" : m.section;
        if (!bySection.has(k)) bySection.set(k, []);
        bySection.get(k)!.push(m);
      }
      for (const [sec, items] of bySection) {
        console.log(`\n    [${sec}]`);
        for (const it of items!) {
          const q = (it.quantity ?? "").padEnd(8);
          const u = (it.unit ?? "").padEnd(10);
          const p = it.preparation ? `  — ${it.preparation}` : "";
          console.log(`      ${q} ${u} ${it.name}${p}`);
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
