"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { EditorIngredient } from "@/types/recipe";
import { cellInputClass } from "./styles";
import UnitDropdown from "./UnitDropdown";

/**
 * Shared grid template for the column-header row and every ingredient row,
 * so the columns line up. Columns:
 *   grip | name | qty | unit | notes | delete
 */
export const ROW_GRID =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_3.5rem_7.5rem_minmax(0,1.3fr)_1.75rem] " +
  "items-center gap-2";

export default function IngredientRow({
  dndId,
  ingredient,
  onChange,
  onDelete,
}: {
  dndId: string;
  ingredient: EditorIngredient;
  onChange: (patch: Partial<EditorIngredient>) => void;
  onDelete: () => void;
}) {
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

  return (
    <div ref={setNodeRef} style={style} className={ROW_GRID + " bg-card py-1"}>
      {/* Drag handle — keyboard-accessible: focus it, Space to lift, arrows
          to move, Space to drop (via @dnd-kit's KeyboardSensor). */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Drag to reorder ingredient"
        className="flex cursor-grab touch-none justify-center text-ink-muted hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      {/* Name */}
      <input
        className={cellInputClass}
        aria-label="Ingredient name"
        value={ingredient.name}
        placeholder="Ingredient"
        onChange={(e) => onChange({ name: e.target.value })}
      />

      {/* Quantity */}
      <input
        className={cellInputClass}
        aria-label="Quantity"
        value={ingredient.quantity}
        placeholder="Qty"
        onChange={(e) => onChange({ quantity: e.target.value })}
      />

      {/* Unit */}
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

      {/* Delete */}
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
