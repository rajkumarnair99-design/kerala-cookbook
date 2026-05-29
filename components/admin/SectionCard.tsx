"use client";

import { useState, type KeyboardEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { EditorIngredient, EditorSection } from "@/types/recipe";
import { cellInputClass } from "./styles";
import IngredientRow, { ROW_GRID } from "./IngredientRow";
import { ingredientDndId, sectionDndId } from "./dnd-helpers";

export default function SectionCard({
  section,
  ingredients,
  onRename,
  onToggleCollapse,
  onDelete,
  onAddIngredient,
  onIngredientChange,
  onIngredientDelete,
  onReorderIngredients,
}: {
  section: EditorSection;
  /** This section's ingredients, already in display order. */
  ingredients: EditorIngredient[];
  onRename: (name: string) => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onAddIngredient: () => void;
  onIngredientChange: (indexInSection: number, patch: Partial<EditorIngredient>) => void;
  onIngredientDelete: (indexInSection: number) => void;
  /** Reorder this section's rows from one index to another (within-section only). */
  onReorderIngredients: (fromIndex: number, toIndex: number) => void;
}) {
  // Inline rename. New sections arrive with an empty name and open straight
  // into edit mode; existing sections start in display mode.
  const [editing, setEditing] = useState(section.name === "");
  const [draft, setDraft] = useState(section.name);

  // This section is itself a sortable item in the parent's section list.
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionDndId(section) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  // Its own DnD context for reordering rows WITHIN this section. A separate
  // context per section makes cross-section dragging impossible by design.
  const rowSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onRowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ingredients.findIndex((i) => ingredientDndId(i) === active.id);
    const to = ingredients.findIndex((i) => ingredientDndId(i) === over.id);
    if (from < 0 || to < 0) return;
    onReorderIngredients(from, to);
  }

  function commitName() {
    onRename(draft.trim());
    setEditing(false);
  }
  function cancelName() {
    setDraft(section.name);
    setEditing(false);
  }
  function onNameKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitName();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelName();
    }
  }

  const count = ingredients.length;
  const countLabel = `${count} ${count === 1 ? "ingredient" : "ingredients"}`;

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-rule bg-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Section drag handle */}
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="Drag to reorder section"
          className="cursor-grab touch-none text-ink-muted hover:text-ink active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>

        {/* Name — display or inline edit. */}
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={onNameKey}
            placeholder="Section name…"
            aria-label="Section name"
            className={cellInputClass + " max-w-xs"}
          />
        ) : (
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink">
            {section.name || "Untitled section"}
          </h3>
        )}

        {/* Right-aligned: count + controls */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-ink-muted">{countLabel}</span>
          {!editing && (
            <button
              type="button"
              aria-label="Rename section"
              onClick={() => {
                setDraft(section.name);
                setEditing(true);
              }}
              className="text-ink-muted hover:text-accent-ink"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            aria-label="Delete section"
            onClick={onDelete}
            className="text-ink-muted hover:text-accent-ink"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={section.collapsed ? "Expand section" : "Collapse section"}
            aria-expanded={!section.collapsed}
            onClick={onToggleCollapse}
            className="text-ink-muted hover:text-ink"
          >
            {section.collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Body — only when expanded */}
      {!section.collapsed && (
        <div className="border-t border-rule px-4 pb-3 pt-2">
          {/* Column headers — aligned to the row grid. */}
          {count > 0 && (
            <div
              className={
                ROW_GRID +
                " px-0 pb-1 text-[10px] uppercase tracking-[0.1em] text-ink-muted"
              }
            >
              <span />
              <span>Ingredient</span>
              <span>Qty</span>
              <span>Unit</span>
              <span>Notes (optional)</span>
              <span />
            </div>
          )}

          {count === 0 ? (
            <p className="px-1 py-3 text-sm text-ink-soft">
              No ingredients yet. Add the first one below.
            </p>
          ) : (
            <DndContext
              sensors={rowSensors}
              collisionDetection={closestCenter}
              onDragEnd={onRowDragEnd}
            >
              <SortableContext
                items={ingredients.map((i) => ingredientDndId(i))}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-rule/60">
                  {ingredients.map((ing, index) => (
                    <IngredientRow
                      key={ingredientDndId(ing)}
                      dndId={ingredientDndId(ing)}
                      ingredient={ing}
                      onChange={(patch) => onIngredientChange(index, patch)}
                      onDelete={() => onIngredientDelete(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add ingredient — the ONLY way to add an ingredient. */}
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={onAddIngredient}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-background"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add ingredient
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
