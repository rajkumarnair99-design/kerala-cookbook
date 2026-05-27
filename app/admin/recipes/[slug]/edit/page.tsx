import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/admin-auth";
import { getAllCategories, getRecipeForEditor } from "@/lib/recipes";
import RecipeEditor from "@/components/admin/RecipeEditor";
import { saveRecipe } from "./actions";

/**
 * The recipe editor page. Protected by requireOwner(). Loads the full
 * recipe and the category list, then hands them to the RecipeEditor
 * client component along with the Save action.
 */
export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireOwner();

  const { slug } = await params;
  const [recipe, categories] = await Promise.all([
    getRecipeForEditor(slug),
    getAllCategories(),
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <RecipeEditor
      recipe={recipe}
      categories={categories}
      saveAction={saveRecipe}
    />
  );
}
