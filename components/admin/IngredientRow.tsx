"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { EditorIngredient } from "@/types/recipe";
import { cellInputClass } from "./styles";
import UnitDropdown from "./UnitDropdown";

/**
 * Shared grid template for the column-header row and every ingredient row —
 * used in BOTH read and edit state so the columns line up and there's no
 * horizontal jump when a section flips between the two. Columns:
 *   grip | name | qty | unit | notes | delete
 */
export const ROW_GRID =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_3.5rem_7.5rem_minmax(0,1.3fr)_1.75rem] " +
  "items-center gap-2";

export default function IngredientRow({
  dndId,
  ingredient,
  editing,
  onChange,
  onDelete,
}: {
  dndId: string;
  ingredient: EditorIngredient;
  /** True when the section is in edit mode. False → quiet read display. */
  editing: boolean;
  onChange: (patch: Partial<EditorIngredient>) => void;
  onDelete: () => void;
}) {
  // Called unconditionally (rules of hooks); only wired to a grip in edit mode.
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dndId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  // READ — quiet three-column text on the same grid (grip + delete columns
  // left empty to preserve alignment). Empty notes render as nothing.
  if (!editing) {
    return (
      <div ref={setNodeRef} style={style} className={ROW_GRID + " py-1.5"}>
        <span aria-hidden />
        <span className="truncate text-sm text-ink">{ingredient.name}</span>
        <span className="text-sm text-ink-soft">{ingredient.quantity}</span>
        <span className="text-sm text-ink-soft">{ingredient.unit}</span>
        <span className="truncate text-sm text-ink-soft">
          {ingredient.preparation}
        </span>
        <span aria-hidden />
      </div>
    );
  }

  // EDIT — inputs + drag handle + unit dropdown + delete.
  return (
    <div ref={setNodeRef} style={style} className={ROW_GRID + " bg-card py-1"}>
      {/* Drag handle — keyboard-accessible via @dnd-kit's KeyboardSensor. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        data-grip
        aria-label="Drag to reorder ingredient"
        className="flex cursor-grab touch-none justify-center text-ink-muted hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      <input
        className={cellInputClass}
        aria-label="Ingredient name"
        value={ingredient.name}
        placeholder="Ingredient"
        onChange={(e) => onChange({ name: e.target.value })}
      />

      <input
        className={cellInputClass}
        aria-label="Quantity"
        value={ingredient.quantity}
        placeholder="Qty"
        onChange={(e) => onChange({ quantity: e.target.value })}
      />

      <UnitDropdown
        value={ingredient.unit}
        onChange={(unit) => onChange({ unit })}
      />

      {/* Notes → maps to the preparation column (label change only). */}
      <input
        className={cellInputClass}
        aria-label="Notes"
        value={ingredient.preparation}
        onChange={(e) => onChange({ preparation: e.target.value })}
      />

      <button
        type="button"
        aria-label="Delete ingredient"
        onClick={onDelete}
        className="flex justify-center text-ink-muted hover:text-accent-ink"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
