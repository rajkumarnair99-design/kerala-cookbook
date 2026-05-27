import Link from "next/link";
import { requireOwner } from "@/lib/admin-auth";
import { getRecipeSummaries } from "@/lib/recipes";
import AdminHeader from "@/components/AdminHeader";

/**
 * The /admin home — the full recipe list. Each recipe links to its
 * editor. Protected: requireOwner() redirects anyone who is not the owner.
 */
export default async function AdminRecipesPage() {
  const user = await requireOwner();
  const recipes = await getRecipeSummaries();

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email ?? ""} />

      <main className="flex-1 w-full mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-3xl text-ink">Recipes</h1>
            <p className="text-sm text-ink-muted mt-1">
              {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} in
              the cookbook
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Adding brand-new recipes arrives in Stage 5"
            className="rounded-lg border border-rule bg-surface px-4 py-2 text-sm text-ink-muted cursor-not-allowed"
          >
            + New recipe — Coming in Stage 5
          </button>
        </div>

        {recipes.length === 0 ? (
          <p className="mt-10 text-ink-soft">No recipes yet.</p>
        ) : (
          <ul className="mt-8 bg-surface border border-rule rounded-2xl overflow-hidden">
            {recipes.map((recipe, index) => (
              <li
                key={recipe.slug}
                className={index > 0 ? "border-t border-rule" : undefined}
              >
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="font-serif text-lg text-ink truncate">
                      {recipe.title}
                    </h2>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {recipe.categoryName ?? "Uncategorised"}
                      {" · "}
                      {recipe.author ? `by ${recipe.author}` : "no author yet"}
                    </p>
                  </div>
                  <Link
                    href={`/admin/recipes/${recipe.slug}/edit`}
                    className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
