import { getSource } from "@/lib/recipes";

export default function Footer() {
  const source = getSource();
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 text-sm text-ink-muted flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="font-serif italic text-base text-ink-soft leading-relaxed">
          {source.book_title}
        </div>
        <div className="leading-relaxed sm:text-right">
          <div>
            Recipes by {source.recipes_by}. Translated by {source.translated_by}.
          </div>
          <div className="text-ink-muted/80">© {source.year}</div>
        </div>
      </div>
    </footer>
  );
}
