/**
 * READ-ONLY. Explains step-4's canary diff in plain field-level terms:
 * compares the saved snapshot to the current DB for the flagged section
 * and ingredient ids, so we can see exactly what each edit did.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Sec = { id: number; name: string; sort_order: number; collapsed: boolean };
type Ing = {
  id: number;
  section_id: number;
  section: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  preparation: string | null;
  sort_order: number;
};

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const snap = JSON.parse(
    readFileSync(join(process.cwd(), "scripts", ".snapshots", "nadan-before.json"), "utf8"),
  );
  const beforeSecs: Sec[] = snap.sections;
  const beforeIngs: Ing[] = snap.ingredients;

  const { data: recipe } = await supabase
    .from("recipes").select("id").eq("slug", "nadan-chicken-curry").single();

  const { data: afterSecs } = await supabase
    .from("recipe_sections")
    .select("id, name, sort_order, collapsed")
    .eq("recipe_id", recipe!.id)
    .order("sort_order")
    .returns<Sec[]>();

  const { data: afterIngs } = await supabase
    .from("recipe_ingredients")
    .select("id, section_id, section, name, quantity, unit, preparation, sort_order")
    .eq("recipe_id", recipe!.id)
    .order("sort_order")
    .returns<Ing[]>();

  const bSec = new Map(beforeSecs.map((s) => [s.id, s]));
  const aSec = new Map((afterSecs ?? []).map((s) => [s.id, s]));
  const bIng = new Map(beforeIngs.map((i) => [i.id, i]));
  const aIng = new Map((afterIngs ?? []).map((i) => [i.id, i]));

  console.log("══ SECTIONS ══\n");
  for (const id of new Set([...bSec.keys(), ...aSec.keys()])) {
    const b = bSec.get(id);
    const a = aSec.get(id);
    if (!b) {
      console.log(`+ ADDED section id=${id}: name="${a!.name}" sort=${a!.sort_order} collapsed=${a!.collapsed}`);
    } else if (!a) {
      console.log(`- REMOVED section id=${id}: name="${b.name}"`);
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      const diffs: string[] = [];
      if (b.name !== a.name) diffs.push(`name "${b.name}" → "${a.name}"`);
      if (b.sort_order !== a.sort_order) diffs.push(`sort ${b.sort_order} → ${a.sort_order}`);
      if (b.collapsed !== a.collapsed) diffs.push(`collapsed ${b.collapsed} → ${a.collapsed}`);
      console.log(`~ CHANGED section id=${id} (${b.name}): ${diffs.join(", ")}`);
    }
  }

  console.log("\n══ INGREDIENTS ══\n");
  for (const id of new Set([...bIng.keys(), ...aIng.keys()])) {
    const b = bIng.get(id);
    const a = aIng.get(id);
    if (!b) {
      console.log(`+ ADDED ingredient id=${id}: "${a!.name}" qty="${a!.quantity}" unit="${a!.unit}" notes="${a!.preparation}" section_id=${a!.section_id}`);
    } else if (!a) {
      console.log(`- REMOVED ingredient id=${id}: "${b.name}"`);
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      const diffs: string[] = [];
      if (b.section_id !== a.section_id) diffs.push(`section_id ${b.section_id} → ${a.section_id}`);
      if ((b.section ?? "") !== (a.section ?? "")) diffs.push(`section-text "${b.section}" → "${a.section}"`);
      if (b.name !== a.name) diffs.push(`name "${b.name}" → "${a.name}"`);
      if ((b.quantity ?? "") !== (a.quantity ?? "")) diffs.push(`qty "${b.quantity}" → "${a.quantity}"`);
      if ((b.unit ?? "") !== (a.unit ?? "")) diffs.push(`unit "${b.unit}" → "${a.unit}"`);
      if ((b.preparation ?? "") !== (a.preparation ?? "")) diffs.push(`notes "${b.preparation}" → "${a.preparation}"`);
      if (b.sort_order !== a.sort_order) diffs.push(`sort ${b.sort_order} → ${a.sort_order}`);
      console.log(`~ CHANGED id=${id} (${b.name}): ${diffs.join(", ")}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
