import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CookMode from "@/components/cook/CookMode";
import { getAllRecipes, getRecipeBySlug } from "@/lib/recipes";

export async function generateStaticParams() {
  return getAllRecipes().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata(
  props: PageProps<"/recipes/[slug]/cook">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) return { title: "Cook mode" };
  return {
    title: `Cook mode · ${recipe.title}`,
    description: `Cook ${recipe.title} step by step.`,
  };
}

export default async function CookModePage(
  props: PageProps<"/recipes/[slug]/cook">,
) {
  const { slug } = await props.params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) notFound();
  return <CookMode recipe={recipe} />;
}
