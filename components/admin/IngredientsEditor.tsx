"use client";

import { useState } from "react";
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
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { EditorIngredient, EditorSection } from "@/types/recipe";
import SectionCard from "./SectionCard";
import ConfirmDialog from "./ConfirmDialog";
import { sectionDndId } from "./dnd-helpers";

/* ------------------------------------------------------------------ */
/* Identity helpers — a section is matched by its DB id when saved, or */
/* by its temporary client_key when newly added but not yet saved.    */
/* ------------------------------------------------------------------ */

function sameSection(a: EditorSection, b: EditorSection): boolean {
  return a.id !== null && b.id !== null
    ? a.id === b.id
    : a.client_key !== null && a.client_key === b.client_key;
}

function ingredientBelongs(ing: EditorIngredient, s: EditorSection): boolean {
  return s.id !== null
    ? ing.section_id === s.id
    : ing.section_client_key === s.client_key;
}

/** A section's ingredients, in flat-array order. */
function sectionIngredients(
  s: EditorSection,
  ingredients: EditorIngredient[],
): EditorIngredient[] {
  return ingredients.filter((ing) => ingredientBelongs(ing, s));
}

/** Re-flatten ingredients grouped by the given section order (preserving
 *  each section's internal order). Keeps the saved sort_order matching the
 *  visible layout. */
function regroup(
  sections: EditorSection[],
  ingredients: EditorIngredient[],
): EditorIngredient[] {
  return sections.flatMap((s) => sectionIngredients(s, ingredients));
}

/** Flat-array index of the k-th ingredient within a section. */
function flatIndexOf(
  s: EditorSection,
  indexInSection: number,
  ingredients: EditorIngredient[],
): number {
  let seen = -1;
  for (let i = 0; i < ingredients.length; i += 1) {
    if (ingredientBelongs(ingredients[i], s)) {
      seen += 1;
      if (seen === indexInSection) return i;
    }
  }
  return -1;
}

function newClientKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A blank ingredient that belongs to the given section, carrying the
 *  section link (real id, or client_key for a not-yet-saved section) plus a
 *  transient _dndKey so drag-and-drop has a stable id before it's saved. */
function blankIngredient(section: EditorSection): EditorIngredient {
  return {
    id: null,
    section_id: section.id,
    section_client_key: section.id === null ? section.client_key : null,
    section: section.name,
    name: "",
    quantity: "",
    unit: "",
    preparation: "",
    optional: false,
    _dndKey: newClientKey(),
  };
}

export default function IngredientsEditor({
  sections,
  ingredients,
  onChange,
}: {
  sections: EditorSection[];
  ingredients: EditorIngredient[];
  onChange: (sections: EditorSection[], ingredients: EditorIngredient[]) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<EditorSection | null>(null);

  // Sensors for reordering the sections themselves. (Each section card has
  // its own context for reordering its rows — see SectionCard.)
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---- section operations ---- */

  function addSection() {
    const newSection: EditorSection = {
      id: null,
      client_key: newClientKey(),
      name: "",
      sort_order: sections.length,
      collapsed: false,
    };
    onChange([...sections, newSection], ingredients);
  }

  function renameSection(s: EditorSection, name: string) {
    onChange(
      sections.map((x) => (sameSection(x, s) ? { ...x, name } : x)),
      // keep the legacy display mirror on each ingredient in sync
      ingredients.map((ing) =>
        ingredientBelongs(ing, s) ? { ...ing, section: name } : ing,
      ),
    );
  }

  function toggleCollapse(s: EditorSection) {
    onChange(
      sections.map((x) => (sameSection(x, s) ? { ...x, collapsed: !x.collapsed } : x)),
      ingredients,
    );
  }

  function deleteSection(s: EditorSection) {
    onChange(
      sections.filter((x) => !sameSection(x, s)),
      ingredients.filter((ing) => !ingredientBelongs(ing, s)),
    );
  }

  function requestDeleteSection(s: EditorSection) {
    if (sectionIngredients(s, ingredients).length === 0) {
      deleteSection(s); // empty: no confirmation needed
    } else {
      setPendingDelete(s);
    }
  }

  function reorderSections(from: number, to: number) {
    if (from === to) return;
    const newSections = arrayMove(sections, from, to);
    // Re-flatten so the saved order matches the new section order.
    onChange(newSections, regroup(newSections, ingredients));
  }

  function onSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => sectionDndId(s) === active.id);
    const to = sections.findIndex((s) => sectionDndId(s) === over.id);
    if (from < 0 || to < 0) return;
    reorderSections(from, to);
  }

  /* ---- ingredient operations (scoped to a section) ---- */

  function addIngredient(s: EditorSection) {
    const next = [...ingredients, blankIngredient(s)];
    onChange(sections, regroup(sections, next));
  }

  function changeIngredient(
    s: EditorSection,
    indexInSection: number,
    patch: Partial<EditorIngredient>,
  ) {
    const flatIdx = flatIndexOf(s, indexInSection, ingredients);
    if (flatIdx < 0) return;
    onChange(
      sections,
      ingredients.map((ing, i) => (i === flatIdx ? { ...ing, ...patch } : ing)),
    );
  }

  function deleteIngredient(s: EditorSection, indexInSection: number) {
    const flatIdx = flatIndexOf(s, indexInSection, ingredients);
    if (flatIdx < 0) return;
    onChange(
      sections,
      ingredients.filter((_, i) => i !== flatIdx),
    );
  }

  function reorderIngredients(
    s: EditorSection,
    fromIndex: number,
    toIndex: number,
  ) {
    if (fromIndex === toIndex) return;
    const moved = arrayMove(sectionIngredients(s, ingredients), fromIndex, toIndex);
    // Rebuild the flat array: target section uses the reordered slice;
    // every other section keeps its rows in place.
    const next = sections.flatMap((sec) =>
      sameSection(sec, s) ? moved : sectionIngredients(sec, ingredients),
    );
    onChange(sections, next);
  }

  const pendingCount = pendingDelete
    ? sectionIngredients(pendingDelete, ingredients).length
    : 0;

  return (
    <>
      {/* Header — heading + subtitle on the left, "+ Add section" on the right.
          No top quick-add bar (intentionally removed). */}
      <div className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-medium text-ink">Ingredients</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Add, edit, and reorder ingredients for your recipe.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-background px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent-ink"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add section
          </button>
          <p className="mt-1.5 max-w-[16rem] text-xs text-ink-muted">
            Create a new ingredient section
          </p>
        </div>
      </div>

      {/* Section cards — sortable. */}
      <DndContext
        sensors={sectionSensors}
        collisionDetection={closestCenter}
        onDragEnd={onSectionDragEnd}
      >
        <SortableContext
          items={sections.map((s) => sectionDndId(s))}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-6 space-y-4">
            {sections.map((section) => (
              <SectionCard
                key={sectionDndId(section)}
                section={section}
                ingredients={sectionIngredients(section, ingredients)}
                onRename={(name) => renameSection(section, name)}
                onToggleCollapse={() => toggleCollapse(section)}
                onDelete={() => requestDeleteSection(section)}
                onAddIngredient={() => addIngredient(section)}
                onIngredientChange={(i, patch) => changeIngredient(section, i, patch)}
                onIngredientDelete={(i) => deleteIngredient(section, i)}
                onReorderIngredients={(from, to) =>
                  reorderIngredients(section, from, to)
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-rule bg-card p-8 text-center text-sm text-ink-soft">
          No sections yet. Use “Add section” to create one.
        </p>
      )}

      {/* Delete-section confirmation (only for non-empty sections) */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete section?"
        message={
          pendingDelete
            ? `Delete section “${pendingDelete.name || "Untitled section"}” and its ${pendingCount} ${
                pendingCount === 1 ? "ingredient" : "ingredients"
              }? This can’t be undone once you save.`
            : ""
        }
        confirmLabel="Delete section"
        onConfirm={() => {
          if (pendingDelete) deleteSection(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
