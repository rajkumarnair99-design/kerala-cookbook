"use client";

import type { ReactNode } from "react";
import type { EditorIngredient } from "@/types/recipe";

/** Shared 7-column grid template — header and rows must use the same one. */
const gridCols = "grid-cols-[1fr_1.3fr_56px_64px_1.5fr_52px_92px]";

const cellInput =
  "w-full rounded-md border border-rule bg-background px-2 py-1.5 text-sm " +
  "text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent";

function blankIngredient(): EditorIngredient {
  return {
    // null marks a row added in the editor that doesn't exist in the
    // database yet — save_recipe inserts these, then assigns real ids.
    id: null,
    // This placeholder editor predates Stage 2B Session 2. It cannot
    // actually save because it doesn't know which section a new row
    // belongs to. The Session 2 rebuild will set section_id from the
    // section card the user added the row under.
    section_id: null,
    section_client_key: null,
    section: "",
    name: "",
    quantity: "",
    unit: "",
    preparation: "",
    optional: false,
  };
}

export default function IngredientsEditor({
  ingredients,
  onChange,
}: {
  ingredients: EditorIngredient[];
  onChange: (next: EditorIngredient[]) => void;
}) {
  function updateRow(index: number, patch: Partial<EditorIngredient>) {
    onChange(
      ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    );
  }
  function addRow() {
    onChange([...ingredients, blankIngredient()]);
  }
  function removeRow(index: number) {
    onChange(ingredients.filter((_, i) => i !== index));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= ingredients.length) return;
    const next = ingredients.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section className="mt-8 bg-surface border border-rule rounded-2xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl text-ink">Ingredients</h2>
        <span className="text-xs text-ink-muted">
          {ingredients.length}{" "}
          {ingredients.length === 1 ? "ingredient" : "ingredients"}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[700px]">
          <div
            className={`grid ${gridCols} gap-2 px-1 pb-2 text-[10px] uppercase tracking-[0.1em] text-ink-muted`}
          >
            <span>Section</span>
            <span>Name</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Preparation</span>
            <span className="text-center">Optional</span>
            <span />
          </div>

          {ingredients.length === 0 ? (
            <p className="px-1 py-3 text-sm text-ink-soft">
              No ingredients yet. Add the first one below.
            </p>
          ) : (
            <div className="space-y-1.5">
              {ingredients.map((ing, index) => (
                <div
                  key={index}
                  className={`grid ${gridCols} gap-2 items-center`}
                >
                  <input
                    className={cellInput}
                    aria-label="Section"
                    value={ing.section}
                    onChange={(e) =>
                      updateRow(index, { section: e.target.value })
                    }
                  />
                  <input
                    className={cellInput}
                    aria-label="Name"
                    value={ing.name}
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                  />
                  <input
                    className={cellInput}
                    aria-label="Quantity"
                    value={ing.quantity}
                    onChange={(e) =>
                      updateRow(index, { quantity: e.target.value })
                    }
                  />
                  <input
                    className={cellInput}
                    aria-label="Unit"
                    value={ing.unit}
                    onChange={(e) => updateRow(index, { unit: e.target.value })}
                  />
                  <input
                    className={cellInput}
                    aria-label="Preparation"
                    value={ing.preparation}
                    onChange={(e) =>
                      updateRow(index, { preparation: e.target.value })
                    }
                  />
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent"
                      aria-label="Optional ingredient"
                      checked={ing.optional}
                      onChange={(e) =>
                        updateRow(index, { optional: e.target.checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <RowButton
                      label="Move ingredient up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </RowButton>
                    <RowButton
                      label="Move ingredient down"
                      disabled={index === ingredients.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </RowButton>
                    <RowButton
                      label="Remove ingredient"
                      onClick={() => removeRow(index)}
                    >
                      ✕
                    </RowButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-4 rounded-lg border border-rule bg-background px-3 py-2 text-sm text-ink-soft hover:border-accent hover:text-accent-ink transition-colors"
      >
        + Add ingredient
      </button>
    </section>
  );
}

function RowButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="h-7 w-7 shrink-0 rounded-md border border-rule text-xs leading-none text-ink-muted hover:border-accent hover:text-accent-ink disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-ink-muted transition-colors"
    >
      {children}
    </button>
  );
}
