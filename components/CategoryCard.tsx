import Link from "next/link";
import type { Category } from "@/types/recipe";

type Props = {
  category: Category;
  count: number;
};

export default function CategoryCard({ category, count }: Props) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group block rounded-xl border border-rule bg-surface p-6 transition-all hover:border-accent-soft hover:shadow-[0_6px_24px_-16px_rgba(168,90,58,0.35)]"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-xl sm:text-2xl text-ink group-hover:text-accent-ink transition-colors">
          {category.name}
        </h3>
        <span className="text-sm text-ink-muted tabular-nums">
          {count}
        </span>
      </div>
      <div className="mt-2 text-xs uppercase tracking-[0.2em] text-ink-muted">
        {count === 1 ? "1 recipe" : `${count} recipes`}
      </div>
    </Link>
  );
}
