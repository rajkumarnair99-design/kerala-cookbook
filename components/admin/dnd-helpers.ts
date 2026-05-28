import type { EditorIngredient, EditorSection } from "@/types/recipe";

/**
 * Stable drag-and-drop ids. Saved rows/sections use their database id;
 * not-yet-saved ones fall back to their client-side key (sections carry a
 * `client_key`; ingredients carry a transient `_dndKey`).
 */

export function sectionDndId(s: EditorSection): string {
  return s.id !== null ? `section-id-${s.id}` : `section-ck-${s.client_key}`;
}

export function ingredientDndId(ing: EditorIngredient): string {
  return ing.id !== null ? `ing-id-${ing.id}` : `ing-new-${ing._dndKey}`;
}
