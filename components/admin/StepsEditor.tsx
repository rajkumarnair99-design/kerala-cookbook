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
import type { EditorStep } from "@/types/recipe";
import StepCard from "./StepCard";
import StepInserter from "./StepInserter";
import ConfirmDialog from "./ConfirmDialog";
import { stepDndId } from "./dnd-helpers";

function newClientKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function blankStep(): EditorStep {
  return {
    id: null,
    instruction: "",
    timer_minutes: null,
    tip: "",
    photos: [],
    _dndKey: newClientKey(),
  };
}

export default function StepsEditor({
  steps,
  onChange,
  savedNonce,
}: {
  steps: EditorStep[];
  onChange: (steps: EditorStep[]) => void;
  /** Bumps each time the recipe saves successfully. We watch it to drop every
   *  step back to read state (and close all revealed editors) on save. */
  savedNonce: number;
}) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  // Steps currently open for editing, keyed by dnd id (step-id-N / step-new-…).
  // Sticky: a step stays active until the next successful save. Multiple may
  // be active at once. Keying by dnd id means active-state survives reorder.
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set());
  // Which just-inserted step should open with its instruction editor focused.
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null);

  // On a successful save (savedNonce bumps), return every step to read state.
  // Adjusting state during render when a signal changes is React's recommended
  // alternative to a reset effect.
  const [seenNonce, setSeenNonce] = useState(savedNonce);
  if (seenNonce !== savedNonce) {
    setSeenNonce(savedNonce);
    if (activeIds.size > 0) setActiveIds(new Set());
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function activate(id: string) {
    setActiveIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function changeStep(index: number, patch: Partial<EditorStep>) {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function insertStep(index: number) {
    const s = blankStep();
    setJustAddedKey(s._dndKey ?? null);
    activate(stepDndId(s));
    const next = [...steps];
    next.splice(index, 0, s);
    onChange(next);
  }

  function deleteStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = steps.findIndex((s) => stepDndId(s) === active.id);
    const to = steps.findIndex((s) => stepDndId(s) === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(steps, from, to));
  }

  const pending = pendingDelete !== null ? steps[pendingDelete] : null;
  const pendingHasPhoto = pending ? pending.photos.length > 0 : false;

  return (
    <>
      {/* Header — adding now happens between steps (via the "+" inserters), so
          the old top-right "+ Add step" button is replaced by helper text that
          explains the pattern. */}
      <div className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-medium text-ink">Steps</h2>
          <p className="mt-1 text-sm text-ink-muted">Click any step to edit</p>
        </div>
        <p className="shrink-0 text-sm text-ink-muted">+ Click to add step</p>
      </div>

      {/* Timeline */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={steps.map((s) => stepDndId(s))}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-6">
            {/* Inserter above the first step — no rail line above badge 1. */}
            <StepInserter onInsert={() => insertStep(0)} connected={false} />
            {steps.map((step, index) => {
              const id = stepDndId(step);
              return (
                <Fragment key={id}>
                  <StepCard
                    step={step}
                    stepNumber={index + 1}
                    isActive={activeIds.has(id)}
                    autoEdit={
                      step._dndKey != null && step._dndKey === justAddedKey
                    }
                    isFirst={index === 0}
                    isLast={index === steps.length - 1}
                    onActivate={() => activate(id)}
                    onChange={(patch) => changeStep(index, patch)}
                    onDelete={() => setPendingDelete(index)}
                  />
                  {/* Inserter in the gap below this step. It carries the rail
                      line only when there's a following step to connect to. */}
                  <StepInserter
                    onInsert={() => insertStep(index + 1)}
                    connected={index < steps.length - 1}
                  />
                </Fragment>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {steps.length === 0 && (
        <p className="mt-2 rounded-2xl border border-dashed border-rule bg-card p-8 text-center text-sm text-ink-soft">
          No steps yet. Use the “+” above to add the first one.
        </p>
      )}

      {/* Delete confirmation — always; photo-aware message. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete step?"
        message={
          pendingDelete === null
            ? ""
            : pendingHasPhoto
              ? `Delete step ${pendingDelete + 1}? Its photo and instruction will be removed and can't be recovered once you save.`
              : `Delete step ${pendingDelete + 1}? Its instruction will be removed and can't be recovered once you save.`
        }
        confirmLabel="Delete step"
        onConfirm={() => {
          if (pendingDelete !== null) deleteStep(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
