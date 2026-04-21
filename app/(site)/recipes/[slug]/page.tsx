import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CookModeButton from "@/components/CookModeButton";
import FavoriteButton from "@/components/FavoriteButton";
import IngredientList from "@/components/IngredientList";
import StepList from "@/components/StepList";
import {
  getAllRecipes,
  getCategoryBySlug,
  getRecipeBySlug,
} from "@/lib/recipes";

export async function generateStaticParams() {
  return getAllRecipes().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata(
  props: PageProps<"/recipes/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) return { title: "Recipe not found" };
  return {
    title: recipe.title,
    description: recipe.subtitle,
  };
}

export default async function RecipePage(
  props: PageProps<"/recipes/[slug]">,
) {
  const { slug } = await props.params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) notFound();

  const category = getCategoryBySlug(recipe.category_slug);

  return (
    <article className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Breadcrumb */}
      <nav className="mb-6 sm:mb-8 text-sm text-ink-muted">
        <Link href="/" className="hover:text-accent-ink">
          Home
        </Link>
        {category && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/categories/${category.slug}`}
              className="hover:text-accent-ink"
            >
              {category.name}
            </Link>
          </>
        )}
      </nav>

      {/* Hero */}
      <header className="mb-10 sm:mb-12">
        {category && (
          <div className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-accent-ink mb-4 sm:mb-5">
            {category.name}
          </div>
        )}
        <h1 className="font-serif text-[34px] sm:text-5xl md:text-6xl text-ink leading-[1.08] tracking-tight">
          {recipe.title}
        </h1>
        <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-ink-soft leading-relaxed italic font-serif">
          {recipe.subtitle}
        </p>

        <div className="mt-7 sm:mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-ink-muted border-t border-b border-rule py-4">
          <span>
            <span className="text-ink-muted/80">Serves</span>{" "}
            <span className="text-ink-soft">{recipe.serves}</span>
          </span>
          {recipe.tags.length > 0 && (
            <>
              <span aria-hidden className="text-rule hidden sm:inline">
                |
              </span>
              <ul className="flex flex-wrap gap-2">
                {recipe.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full bg-background border border-rule px-2.5 py-0.5 text-xs text-ink-soft"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <CookModeButton slug={recipe.slug} />
          <FavoriteButton />
        </div>
      </header>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-12 lg:gap-16">
        <section
          aria-labelledby="ingredients-heading"
          className="lg:sticky lg:top-28 lg:self-start"
        >
          <h2
            id="ingredients-heading"
            className="font-serif text-xl sm:text-2xl text-ink mb-5 sm:mb-6"
          >
            Ingredients
          </h2>
          <IngredientList ingredients={recipe.ingredients} />
        </section>

        <section aria-labelledby="steps-heading">
          <h2
            id="steps-heading"
            className="font-serif text-xl sm:text-2xl text-ink mb-6 sm:mb-8"
          >
            Method
          </h2>
          <StepList steps={recipe.steps} />

          {recipe.notes && (
            <aside className="mt-14 rounded-lg bg-surface border border-rule p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-accent-ink mb-2">
                Notes
              </div>
              <p className="text-ink-soft leading-relaxed italic font-serif">
                {recipe.notes}
              </p>
            </aside>
          )}

          <footer className="mt-10 text-sm text-ink-muted border-t border-rule pt-6">
            From <span className="italic">{recipe.source}</span>.
          </footer>
        </section>
      </div>
    </article>
  );
}
