export type Category = {
  slug: string;
  name: string;
};

export type Ingredient = {
  section: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
};

export type Step = {
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  tip: string | null;
  image_urls?: string[] | null;
};

export type Recipe = {
  slug: string;
  title: string;
  subtitle: string;
  category_slug: string;
  serves: string;
  tags: string[];
  source: string;
  notes: string;
  ingredients: Ingredient[];
  steps: Step[];
  video_url?: string | null;
};

/** A lightweight recipe row for list views such as the admin recipe list. */
export type RecipeSummary = {
  slug: string;
  title: string;
  author: string | null;
  categoryName: string | null;
};

/**
 * The editable shape of a recipe used by the admin editor. Text fields are
 * always strings (never null) for simpler form handling. Step photos are
 * read-only in Stage 2.
 */
/**
 * A section grouping for ingredients (e.g. "Main ingredients",
 * "For the seasoning"). First-class entity with its own id, so the
 * editor can rename / reorder / collapse a section and the database
 * row keeps its identity across saves.
 */
export type EditorSection = {
  /** The recipe_sections row id, or null for a section added but not
   *  yet saved. Newly added sections also set client_key so any
   *  newly-added ingredients can point at this section before it has
   *  a real id. */
  id: number | null;
  /** Editor-generated tag for a not-yet-saved section. Null once the
   *  section exists in the database. */
  client_key: string | null;
  name: string;
  sort_order: number;
  /** Whether this section is collapsed in the editor UI. Persisted so
   *  the next page load matches the last layout. */
  collapsed: boolean;
};

export type EditorIngredient = {
  /** The recipe_ingredients row id, or null for an ingredient added but
   *  not yet saved. Carried through state so save_recipe can update each
   *  row in place rather than deleting and re-inserting every row on
   *  every save (which would invalidate any future references to id). */
  id: number | null;
  /** The recipe_sections row id this ingredient belongs to. Null when
   *  the ingredient was added under a NEW (not-yet-saved) section — in
   *  that case section_client_key carries the link instead. Exactly
   *  one of section_id / section_client_key must be set on save. */
  section_id: number | null;
  /** When the ingredient belongs to a newly added section, this matches
   *  the section's client_key in the same save payload. Null otherwise. */
  section_client_key: string | null;
  /** Display-only mirror of the parent section's name. Sourced on read
   *  from recipe_sections; the save function rewrites it from the
   *  resolved section. Will go away in Session 3 along with the legacy
   *  recipe_ingredients.section TEXT column. */
  section: string;
  name: string;
  quantity: string;
  unit: string;
  preparation: string;
  optional: boolean;
};

export type EditorStep = {
  /** The recipe_steps row id, or null for a step added but not yet saved. */
  id: number | null;
  instruction: string;
  timer_minutes: number | null;
  tip: string;
  photos: { url: string }[];
};

export type EditorRecipe = {
  slug: string;
  title: string;
  subtitle: string;
  category_slug: string;
  serves: string;
  tags: string[];
  source: string;
  notes: string;
  story: string;
  author: string;
  /**
   * Recipe-level cover image. Stage 2 carries it through state unchanged
   * (no UI yet); Stage 4 will let the owner upload one. NULL when no
   * hero image has been set.
   */
  hero_image_url: string | null;
  /** The recipe's section rows, in display order. Always at least one
   *  row (Migration 004 guarantees a "Main ingredients" section per
   *  recipe). Carried through state and sent on every save so
   *  save_recipe can match each section by id. */
  sections: EditorSection[];
  ingredients: EditorIngredient[];
  steps: EditorStep[];
};

export type CookbookSource = {
  book_title: string;
  recipes_by: string;
  translated_by: string;
  year: number;
  note: string;
};

export type Cookbook = {
  source: CookbookSource;
  categories: Category[];
  recipes: Recipe[];
};

/**
 * The result of the editor's Save action. On success it carries the
 * freshly re-loaded recipe, so the editor can pick up real ids for any
 * newly added steps (and never insert them twice on the next save).
 */
export type SaveResult =
  | { ok: true; recipe: EditorRecipe }
  | { ok: false; error: string };
