import Link from "next/link";
import type { Recipe } from "@/types/recipe";

type Props = {
  recipe: Recipe;
  showCategory?: boolean;
  categoryName?: string;
};

export default function RecipeCard({
  recipe,
  showCategory = true,
  categoryName,
}: Props) {
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group block rounded-xl border border-rule bg-surface p-6 transition-colors hover:border-accent-soft hover:shadow-[0_6px_24px_-16px_rgba(168,90,58,0.35)] touch-manipulation"
    >
      {showCategory && categoryName && (
        <div className="text-[11px] uppercase tracking-[0.2em] text-accent-ink mb-3">
          {categoryName}
        </div>
      )}
      <h3 className="font-serif text-xl sm:text-2xl leading-tight text-ink group-hover:text-accent-ink transition-colors">
        {recipe.title}
      </h3>
      <p className="mt-2 text-sm text-ink-soft leading-relaxed line-clamp-2">
        {recipe.subtitle}
      </p>
      <div className="mt-4 flex items-center gap-4 text-xs text-ink-muted">
        <span>Serves {recipe.serves}</span>
        <span aria-hidden>·</span>
        <span>
          {recipe.steps.length} {recipe.steps.length === 1 ? "step" : "steps"}
        </span>
      </div>
    </Link>
  );
}
