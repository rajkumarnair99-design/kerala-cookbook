/**
 * URL/key slug helpers for category names.
 *
 * A category's slug is its stable internal key (the primary key of the
 * categories table and the target of recipes.category_slug). We generate it
 * once from the display name when a category is created; renaming a category
 * never changes the slug.
 */

/**
 * Turn a display name into a slug:
 *   "Pickles & Preserves" -> "pickles-preserves"
 *   "Cafe Specials"       -> "cafe-specials"   (accents stripped)
 *   "Soup / Stews"        -> "soup-stews"
 *
 * Lowercases, strips accents/diacritics, turns every run of non-alphanumeric
 * characters into a single hyphen, and trims leading/trailing hyphens.
 * Returns "" for a name with no alphanumeric characters (e.g. "!!!") - the
 * caller is expected to reject that case.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD") // split accented letters into base + combining mark
    .replace(/[\u0300-\u036f]/g, "") // drop the combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics -> one hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/**
 * Like slugify, but guarantees uniqueness against a list of existing slugs by
 * appending -2, -3, ... to the base when needed:
 *   slugifyUnique("Meat Dishes", ["meat-dishes"]) -> "meat-dishes-2"
 */
export function slugifyUnique(name: string, existingSlugs: string[]): string {
  const base = slugify(name);
  const existing = new Set(existingSlugs);
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}
