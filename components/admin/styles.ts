/**
 * Shared form-control styling for the admin editor, so every input,
 * dropdown, and table cell reads the same warm, minimal look. Mirrors the
 * `inputClass` used on the Overview tab in RecipeEditor.
 */

/** Full-size input (matches the Overview tab's fields). */
export const inputClass =
  "w-full rounded-lg border border-rule bg-inset px-3 py-2 text-ink " +
  "placeholder:text-ink-muted focus:outline-none focus:border-accent " +
  "focus:ring-1 focus:ring-accent";

/** Compact input for table-style rows in the Ingredients editor. */
export const cellInputClass =
  "w-full rounded-md border border-rule bg-inset px-2 py-1.5 text-sm " +
  "text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent " +
  "focus:ring-1 focus:ring-accent";
