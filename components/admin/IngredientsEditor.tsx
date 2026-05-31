"use client";

import { Fragment, useState } from "react";
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
import type { EditorIngredient, EditorSection } from "@/types/recipe";
import SectionCard from "./SectionCard";
import SectionInserter from "./SectionInserter";
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
 *  each section's internal order). */
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

/** A blank ingredient that belongs to the given section. */
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

const isBlankIngredient = (i: EditorIngredient) =>
  !i.name.trim() &&
  !i.quantity.trim() &&
  !i.unit.trim() &&
  !i.preparation.trim();

export default function IngredientsEditor({
  sections,
  ingredients,
  onChange,
  savedNonce,
}: {
  sections: EditorSection[];
  ingredients: EditorIngredient[];
  onChange: (sections: EditorSection[], ingredients: EditorIngredient[]) => void;
  /** Bumps on each successful save; we watch it to drop every section back to
   *  read state (mirrors the Steps tab). */
  savedNonce: number;
}) {
  const [pendingDelete, setPendingDelete] = useState<EditorSection | null>(null);
  // Sections currently in edit mode, keyed by section dnd id. Sticky: a section
  // stays in edit until the next save or an outside-click with no real edits.
  const [editingSectionIds, setEditingSectionIds] = useState<Set<string>>(
    () => new Set(),
  );
  // Which just-inserted section should autofocus its name input.
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null);

  // On a successful save, return every section to read state.
  const [seenNonce, setSeenNonce] = useState(savedNonce);
  if (seenNonce !== savedNonce) {
    setSeenNonce(savedNonce);
    if (editingSectionIds.size > 0) setEditingSectionIds(new Set());
  }

  // Sensors for reordering the sections themselves.
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---- edit-state ---- */

  function activate(id: string) {
    setEditingSectionIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // Outside-click on a section with no real edits asks to deactivate it. On the
  // way out we drop any unsaved BLANK ingredient rows (so "Add ingredient" then
  // click-away leaves nothing behind); a brand-new section that's still empty is
  // removed entirely. Saved sections just return to read state.
  function deactivate(id: string) {
    const s = sections.find((x) => sectionDndId(x) === id) ?? null;
    setEditingSectionIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (!s) return;

    const afterDrop = ingredients.filter(
      (i) => !(ingredientBelongs(i, s) && i.id === null && isBlankIngredient(i)),
    );
    const remaining = afterDrop.filter((i) => ingredientBelongs(i, s));
    const emptyNew =
      s.id === null && s.name.trim() === "" && remaining.length === 0;

    if (emptyNew) {
      onChange(
        sections.filter((x) => !sameSection(x, s)),
        afterDrop.filter((i) => !ingredientBelongs(i, s)),
      );
    } else if (afterDrop.length !== ingredients.length) {
      onChange(sections, afterDrop);
    }
  }

  /* ---- section operations ---- */

  function insertSection(index: number) {
    const s: EditorSection = {
      id: null,
      client_key: newClientKey(),
      name: "",
      sort_order: index,
      collapsed: false,
    };
    setJustAddedKey(s.client_key);
    activate(sectionDndId(s));
    const next = [...sections];
    next.splice(index, 0, s);
    onChange(next, ingredients);
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
      sections.map((x) =>
        sameSection(x, s) ? { ...x, collapsed: !x.collapsed } : x,
      ),
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
    const moved = arrayMove(
      sectionIngredients(s, ingredients),
      fromIndex,
      toIndex,
    );
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
      {/* Header — adding now happens between sections (via the "+" inserters),
          so the old top-right "+ Add section" button is replaced by helper
          text that explains the pattern. */}
      <div className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-medium text-ink">
            Ingredients
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Add, edit, and reorder ingredients for your recipe.
            <br />
            Press <span className="font-semibold">Save recipe</span> when you
            are done.
          </p>
        </div>
        <p className="shrink-0 text-sm text-ink-muted">+ Click to add section</p>
      </div>

      {/* Section cards — sortable, with "+" inserters between/around them. */}
      <DndContext
        sensors={sectionSensors}
        collisionDetection={closestCenter}
        onDragEnd={onSectionDragEnd}
      >
        <SortableContext
          items={sections.map((s) => sectionDndId(s))}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-6">
            {/* Inserter above the first section. */}
            <SectionInserter onInsert={() => insertSection(0)} />
            {sections.map((section, index) => {
              const id = sectionDndId(section);
              return (
                <Fragment key={id}>
                  <SectionCard
                    section={section}
                    ingredients={sectionIngredients(section, ingredients)}
                    isActive={editingSectionIds.has(id)}
                    autoFocusName={
                      section.client_key != null &&
                      section.client_key === justAddedKey
                    }
                    dialogOpen={pendingDelete !== null}
                    onActivate={() => activate(id)}
                    onRequestDeactivate={() => deactivate(id)}
                    onRename={(name) => renameSection(section, name)}
                    onToggleCollapse={() => toggleCollapse(section)}
                    onDelete={() => requestDeleteSection(section)}
                    onAddIngredient={() => addIngredient(section)}
                    onIngredientChange={(i, patch) =>
                      changeIngredient(section, i, patch)
                    }
                    onIngredientDelete={(i) => deleteIngredient(section, i)}
                    onReorderIngredients={(from, to) =>
                      reorderIngredients(section, from, to)
                    }
                  />
                  {/* Inserter in the gap below this section. */}
                  <SectionInserter
                    onInsert={() => insertSection(index + 1)}
                  />
                </Fragment>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <p className="mt-2 rounded-2xl border border-dashed border-rule bg-card p-8 text-center text-sm text-ink-soft">
          No sections yet. Use the “+” above to add the first one.
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
