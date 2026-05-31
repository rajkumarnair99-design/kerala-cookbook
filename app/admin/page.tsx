import { requireOwner } from "@/lib/admin-auth";
import { getAdminCategories, getRecipeSummaries } from "@/lib/recipes";
import AdminHeader from "@/components/AdminHeader";
import AdminRecipeList from "@/components/admin/AdminRecipeList";

/**
 * The /admin home — the recipe list. A fixed-height shell (like the editor):
 * the full-width AdminHeader on top, then AdminRecipeList renders the left
 * sidebar + the scrolling content column. Protected: requireOwner() redirects
 * anyone who is not the owner.
 */
export default async function AdminRecipesPage() {
  const user = await requireOwner();
  const [categories, recipes] = await Promise.all([
    getAdminCategories(),
    getRecipeSummaries(),
  ]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AdminHeader email={user.email ?? ""} />
      <AdminRecipeList categories={categories} recipes={recipes} />
    </div>
  );
}
