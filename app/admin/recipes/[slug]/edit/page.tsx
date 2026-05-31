import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/admin-auth";
import { getAllCategories, getRecipeForEditor } from "@/lib/recipes";
import RecipeEditor from "@/components/admin/RecipeEditor";
import { saveRecipe } from "./actions";

/**
 * Per-recipe browser-tab title — e.g. "Nadan Chicken Curry · Good Food at
 * Home" (the layout's "%s · Good Food at Home" template supplies the suffix),
 * mirroring the public recipe page. getRecipeForEditor is React-cached, so this
 * shares the page's own load rather than issuing a second query.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipeForEditor(slug);
  return { title: recipe ? recipe.title : "Recipe not found" };
}

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
