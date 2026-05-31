import { requireOwner } from "@/lib/admin-auth";
import { getAdminCategories, getRecipeSummaries } from "@/lib/recipes";
import AdminHeader from "@/components/AdminHeader";
import AdminRecipeList from "@/components/admin/AdminRecipeList";

/**
 * The /admin home — the recipe list, grouped by category and ordered by each
 * category's sort_order (recipes within a category in their own sort_order).
 * Each row links to its editor. Protected: requireOwner() redirects anyone who
 * is not the owner.
 */
export default async function AdminRecipesPage() {
  const user = await requireOwner();
  const [categories, recipes] = await Promise.all([
    getAdminCategories(),
    getRecipeSummaries(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader email={user.email ?? ""} />
      <main className="w-full flex-1">
        <AdminRecipeList categories={categories} recipes={recipes} />
      </main>
    </div>
  );
}
