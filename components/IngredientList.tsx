import type { Ingredient } from "@/types/recipe";

type Props = {
  ingredients: Ingredient[];
};

function formatAmount(ing: Ingredient): string {
  const parts = [ing.quantity, ing.unit].filter(Boolean);
  return parts.join(" ");
}

function IngredientRow({ ing }: { ing: Ingredient }) {
  const amount = formatAmount(ing);
  return (
    <li className="flex items-baseline gap-4 py-2.5 border-b border-rule last:border-b-0">
      <span className="font-serif text-base text-ink-soft tabular-nums w-24 flex-none">
        {amount || <span className="text-ink-muted italic">to taste</span>}
      </span>
      <span className="flex-1 text-ink">
        {ing.name}
        {ing.preparation && !amount ? null : (
          ing.preparation && (
            <span className="text-ink-muted">, {ing.preparation}</span>
          )
        )}
        {ing.optional && (
          <span className="ml-2 text-xs text-ink-muted italic">(optional)</span>
        )}
      </span>
    </li>
  );
}

export default function IngredientList({ ingredients }: Props) {
  // Group by section (null section comes first as "main")
  const sections = new Map<string, Ingredient[]>();
  for (const ing of ingredients) {
    const key = ing.section ?? "";
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(ing);
  }

  const entries = Array.from(sections.entries());

  return (
    <div className="space-y-8">
      {entries.map(([section, items]) => (
        <div key={section || "main"}>
          {section && (
            <h3 className="font-serif text-sm uppercase tracking-[0.2em] text-accent-ink mb-3">
              {section}
            </h3>
          )}
          <ul>
            {items.map((ing, i) => (
              <IngredientRow key={`${section}-${i}-${ing.name}`} ing={ing} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
