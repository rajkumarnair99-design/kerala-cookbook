"use client";

import { useEffect, useRef } from "react";
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

type RowSnapshot = {
  name: string;
  quantity: string;
  unit: string;
  preparation: string;
};

const isBlankRow = (i: RowSnapshot) =>
  !i.name.trim() &&
  !i.quantity.trim() &&
  !i.unit.trim() &&
  !i.preparation.trim();

/** A signature of a section's NON-blank rows, in order. Blank rows are ignored
 *  so that merely clicking "Add ingredient" (a blank row) is not a "real edit"
 *  and doesn't pin the section open. */
const contentSig = (rows: RowSnapshot[]) =>
  rows
    .filter((r) => !isBlankRow(r))
    .map((r) => [r.name, r.quantity, r.unit, r.preparation].join("\u0000"))
    .join("\u0001");

const snapshot = (ingredients: EditorIngredient[]): RowSnapshot[] =>
  ingredients.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    preparation: i.preparation,
  }));

/**
 * One ingredient section. Two states (mirrors the Steps tab):
 *
 *  READ (default) — quiet: name + count, a pencil (the SOLE way to enter edit),
 *    a collapse chevron, and the ingredients as plain three-column text. No
 *    grips, no trash, no inputs, no "Add ingredient".
 *
 *  EDIT (isActive) — the pencil has been clicked. Drag handles (section + rows),
 *    trash, column headers, inline inputs, the unit dropdown, and "Add
 *    ingredient" all appear. The section stays open (sticky) once it has real
 *    edits; a click outside with no real edits returns it to read state
 *    (and a brand-new empty section is removed by the parent).
 */
export default function SectionCard({
  section,
  ingredients,
  isActive,
  autoFocusName,
  dialogOpen,
  onActivate,
  onRequestDeactivate,
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
  isActive: boolean;
  /** Autofocus the name input — true for a just-inserted section. */
  autoFocusName: boolean;
  /** Suppress click-outside handling while a dialog (delete confirm) is open. */
  dialogOpen: boolean;
  onActivate: () => void;
  onRequestDeactivate: () => void;
  onRename: (name: string) => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onAddIngredient: () => void;
  onIngredientChange: (
    indexInSection: number,
    patch: Partial<EditorIngredient>,
  ) => void;
  onIngredientDelete: (indexInSection: number) => void;
  /** Reorder this section's rows (within-section only). */
  onReorderIngredients: (fromIndex: number, toIndex: number) => void;
}) {
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

  // The section root, for click-outside containment.
  const rootRef = useRef<HTMLElement | null>(null);

  // Snapshot of the section at activation; "real edits" is derived by comparing
  // the live section to it. (Initialised here, refreshed on the active edge.)
  const baselineRef = useRef<{ name: string; ingredients: RowSnapshot[] }>({
    name: section.name,
    ingredients: snapshot(ingredients),
  });

  // Refresh the baseline on the inactive→active edge (and on mount if it starts
  // active). Ref writes must happen in an effect, not during render.
  useEffect(() => {
    if (isActive) {
      baselineRef.current = {
        name: section.name,
        ingredients: snapshot(ingredients),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const hasRealEdits = () => {
    const b = baselineRef.current;
    return (
      section.name !== b.name ||
      contentSig(snapshot(ingredients)) !== contentSig(b.ingredients)
    );
  };

  // Outside-click deactivation (mirrors StepCard). A click INSIDE the section
  // does nothing (ingredient rows have no reveal editors to release); the grip
  // is exempt so grabbing to drag never deactivates. A click OUTSIDE returns
  // the section to read state unless it has real edits. Suppressed while a
  // dialog is open or a drag is in progress.
  useEffect(() => {
    if (!isActive || dialogOpen) return;
    const onDown = (e: MouseEvent) => {
      if (isDragging) return;
      const root = rootRef.current;
      const target = e.target as HTMLElement | null;
      if (!root || !target) return;
      if (root.contains(target)) {
        return; // inside this section → stay active
      }
      if (!hasRealEdits()) onRequestDeactivate();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // hasRealEdits is read live via refs/props; section fields in deps keep the
    // closure current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, dialogOpen, isDragging, section.name, ingredients, onRequestDeactivate]);

  // Its own DnD context for reordering rows WITHIN this section.
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

  const count = ingredients.length;
  const countLabel = `${count} ${count === 1 ? "ingredient" : "ingredients"}`;

  return (
    <section
      ref={(node) => {
        setNodeRef(node);
        rootRef.current = node;
      }}
      style={style}
      className="rounded-2xl border border-rule bg-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Drag handle — edit state only. */}
        {isActive && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            data-grip
            aria-label="Drag to reorder section"
            className="cursor-grab touch-none text-ink-muted hover:text-ink active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        )}

        {/* Name — display in read; live-write input in edit. */}
        {isActive ? (
          <input
            autoFocus={autoFocusName}
            value={section.name}
            onChange={(e) => onRename(e.target.value)}
            placeholder="Section name…"
            aria-label="Section name"
            className={cellInputClass + " max-w-xs"}
          />
        ) : (
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink">
            {section.name || "Untitled section"}
          </h3>
        )}

        {/* Right-aligned: count + controls. */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-ink-muted">{countLabel}</span>

          {/* Pencil — the SOLE activation trigger; read state only. */}
          {!isActive && (
            <button
              type="button"
              aria-label="Edit section"
              onClick={onActivate}
              className="text-ink-muted hover:text-accent-ink"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          )}

          {/* Trash — edit state only. */}
          {isActive && (
            <button
              type="button"
              aria-label="Delete section"
              onClick={onDelete}
              className="text-ink-muted hover:text-accent-ink"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}

          {/* Collapse / expand — both states. stopPropagation so it never
              triggers a containing handler. */}
          <button
            type="button"
            aria-label={section.collapsed ? "Expand section" : "Collapse section"}
            aria-expanded={!section.collapsed}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
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

      {/* Body — only when expanded. */}
      {!section.collapsed && (
        <div className="border-t border-rule px-4 pb-3 pt-2">
          {/* Column headers — edit state only. */}
          {isActive && count > 0 && (
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
            // Empty body: only the edit-state prompt; read state shows nothing.
            isActive ? (
              <p className="px-1 py-3 text-sm text-ink-soft">
                No ingredients yet. Add the first one below.
              </p>
            ) : null
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
                      editing={isActive}
                      onChange={(patch) => onIngredientChange(index, patch)}
                      onDelete={() => onIngredientDelete(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add ingredient — edit state only; the ONLY way to add a row. */}
          {isActive && (
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
          )}
        </div>
      )}
    </section>
  );
}
