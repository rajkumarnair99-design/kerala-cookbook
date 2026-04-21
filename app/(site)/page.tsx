import Link from "next/link";
import HomeHero from "@/components/HomeHero";
import RecipeCard from "@/components/RecipeCard";
import CategoryCard from "@/components/CategoryCard";
import {
  getAllCategories,
  getRecentRecipes,
  getRecipeCountByCategory,
  getSource,
} from "@/lib/recipes";

export default function Home() {
  const source = getSource();
  const recent = getRecentRecipes(4);
  const categories = getAllCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-10">
      <HomeHero />

      {/* Book note */}
      <section className="py-10 sm:py-14 max-w-2xl">
        <p className="font-serif italic text-base sm:text-lg text-ink-soft leading-relaxed">
          Set down by {source.recipes_by}. Translated by {source.translated_by},
          {" "}
          {source.year}. {source.note}
        </p>
      </section>

      {/* Recently added */}
      <section className="py-10 sm:py-12 border-t border-rule">
        <div className="flex items-baseline justify-between mb-8 sm:mb-10">
          <h2 className="font-serif text-2xl sm:text-3xl text-ink">
            Recently added
          </h2>
          <Link
            href="/categories"
            className="text-sm text-accent-ink hover:text-accent underline-offset-4 hover:underline"
          >
            Browse all
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {recent.map((recipe) => (
            <RecipeCard key={recipe.slug} recipe={recipe} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-10 sm:py-12 border-t border-rule">
        <div className="flex items-baseline justify-between mb-8 sm:mb-10">
          <h2 className="font-serif text-2xl sm:text-3xl text-ink">
            Browse by category
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {categories.map((category) => (
            <CategoryCard
              key={category.slug}
              category={category}
              count={getRecipeCountByCategory(category.slug)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
