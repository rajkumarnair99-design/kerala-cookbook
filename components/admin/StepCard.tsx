"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  GripVertical,
  ImagePlus,
  Leaf,
  Lightbulb,
  Pencil,
  Trash2,
} from "lucide-react";
import type { EditorStep } from "@/types/recipe";
import { stepDndId } from "./dnd-helpers";

/** A textarea that grows with its content (no inner scrollbar). */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className + " resize-none overflow-hidden"}
    />
  );
}

/** A small chiclet action button used in the right-hand stack. */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "inline-flex w-full items-center justify-start gap-1.5 rounded-chiclet border border-rule bg-background px-2.5 py-1.5 text-xs font-medium transition-colors " +
        (disabled
          ? "cursor-not-allowed text-ink-muted"
          : "text-ink-soft hover:border-accent hover:text-accent-ink")
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

/**
 * One step in the timeline. Two states:
 *
 *  READ  (default) — quiet: drag handle, number badge, native-ratio photo,
 *    plain instruction text, optional read-only tip callout, a timer readout
 *    (or a grey clock placeholder when none is set), and a trash control.
 *
 *  EDIT  (isActive) — clicking the card activates it; the four right-column
 *    buttons appear. Per-field editors reveal inline.
 *
 * Closing behaviour (the subtle part):
 *  - Tip & instruction editors are STICKY-ON-CONTENT: once you type something,
 *    they stay open until Save. If opened but left empty/unchanged, a click
 *    elsewhere in the card releases them (Refinement 2).
 *  - The TIMER is different on purpose: its "Add/Edit timer" button reveals an
 *    inline input over the value readout that COMMITS-AND-CLOSES on blur
 *    (empty → no timer). No sticky. The four buttons always stay put; their
 *    labels flip Add↔Edit based on whether the field has content.
 *  - The step itself stays active (sticky) only once it has REAL edits
 *    (data changed from the snapshot taken at activation). With no real edits,
 *    a click outside the step quietly returns it to read state (Refinement 3);
 *    a brand-new empty step is removed entirely by the parent.
 */
export default function StepCard({
  step,
  stepNumber,
  isActive,
  autoEdit,
  isFirst,
  isLast,
  dialogOpen,
  onActivate,
  onRequestDeactivate,
  onChange,
  onDelete,
}: {
  step: EditorStep;
  stepNumber: number;
  isActive: boolean;
  /** A freshly inserted step opens with its instruction editor pre-revealed
   *  and focused so the user can type immediately. */
  autoEdit: boolean;
  /** First / last in the list — controls whether the timeline rail line
   *  extends above / below this step's badge. */
  isFirst: boolean;
  isLast: boolean;
  /** While a modal (delete confirm) is open, suppress click-outside handling so
   *  clicking the dialog doesn't deactivate steps. */
  dialogOpen: boolean;
  onActivate: () => void;
  /** Ask the parent to drop this step from the active set (used on an
   *  outside-click when the step has no real edits). */
  onRequestDeactivate: () => void;
  onChange: (patch: Partial<EditorStep>) => void;
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
  } = useSortable({ id: stepDndId(step) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  // Per-field editor reveals.
  const [instructionOpen, setInstructionOpen] = useState(autoEdit);
  const [tipOpen, setTipOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);

  // Refs for click-outside / click-elsewhere detection.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const instrEditorRef = useRef<HTMLDivElement | null>(null);
  const tipEditorRef = useRef<HTMLDivElement | null>(null);

  // Snapshot of the step's data at activation. "Real edits" is DERIVED by
  // comparing the live step to this baseline — so merely activating, or opening
  // an editor and typing nothing, is not an edit.
  const baselineRef = useRef({
    instruction: step.instruction,
    tip: step.tip,
    timer_minutes: step.timer_minutes,
  });
  // The value each text editor had when revealed — lets us tell "untouched"
  // (revert/close) from "edited" (keep open).
  const instrOpenValueRef = useRef(step.instruction);
  const tipOpenValueRef = useRef(step.tip);

  // On active→inactive (save, or outside-click deactivation) force every editor
  // shut. (Adjusting state during render when a prop changes is React's
  // recommended alternative to a reset effect.)
  const [wasActive, setWasActive] = useState(isActive);
  if (wasActive !== isActive) {
    setWasActive(isActive);
    if (!isActive) {
      setInstructionOpen(false);
      setTipOpen(false);
      setTimerOpen(false);
    }
  }

  // Capture the activation snapshot on the inactive→active edge (and on mount
  // if the step starts active). Done in an effect because ref writes must not
  // happen during render. We intentionally read step.* without listing them as
  // deps — we want the values AS OF activation, not on every later keystroke.
  useEffect(() => {
    if (isActive) {
      baselineRef.current = {
        instruction: step.instruction,
        tip: step.tip,
        timer_minutes: step.timer_minutes,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const photoUrl = step.photos[0]?.url;
  const hasImage = step.photos.length > 0;
  const hasTip = step.tip.trim().length > 0;
  const hasTimer = step.timer_minutes !== null;

  const showTipCallout = isActive ? hasTip || tipOpen : hasTip;
  const tipEditable = isActive && tipOpen;
  const instructionEditable = isActive && instructionOpen;

  function activate() {
    if (!isActive) onActivate();
  }
  function openTip() {
    tipOpenValueRef.current = step.tip;
    setTipOpen(true);
  }
  function openInstruction() {
    instrOpenValueRef.current = step.instruction;
    setInstructionOpen(true);
  }

  const hasRealEdits = () => {
    const b = baselineRef.current;
    return (
      step.instruction !== b.instruction ||
      step.tip !== b.tip ||
      step.timer_minutes !== b.timer_minutes
    );
  };

  // Click-outside / click-elsewhere. Attached only while active and while no
  // dialog is open. INSIDE the row → release an opened-but-untouched tip/
  // instruction editor (the grip is exempt so grabbing to drag never closes an
  // editor; the timer closes via its own onBlur, not here). OUTSIDE the row →
  // deactivate the step unless it has real edits.
  useEffect(() => {
    if (!isActive || dialogOpen) return;
    const onDown = (e: MouseEvent) => {
      if (isDragging) return;
      const row = rowRef.current;
      const target = e.target as HTMLElement | null;
      if (!row || !target) return;

      if (row.contains(target)) {
        if (target.closest("[data-grip]")) return; // protect drag intent
        if (
          instructionOpen &&
          instrEditorRef.current &&
          !instrEditorRef.current.contains(target) &&
          (step.instruction.trim() === "" ||
            step.instruction === instrOpenValueRef.current)
        ) {
          setInstructionOpen(false);
        }
        if (
          tipOpen &&
          tipEditorRef.current &&
          !tipEditorRef.current.contains(target) &&
          (step.tip.trim() === "" || step.tip === tipOpenValueRef.current)
        ) {
          setTipOpen(false);
        }
      } else if (!hasRealEdits()) {
        onRequestDeactivate();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // hasRealEdits is read live via refs/props; step fields in deps keep the
    // closure current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isActive,
    dialogOpen,
    isDragging,
    instructionOpen,
    tipOpen,
    step.instruction,
    step.tip,
    step.timer_minutes,
    onRequestDeactivate,
  ]);

  return (
    // ROW = timeline rail (outside, left) + the card. rowRef is used for
    // click-outside detection; setNodeRef makes the whole row the sortable node.
    <div
      ref={(node) => {
        setNodeRef(node);
        rowRef.current = node;
      }}
      style={style}
      className="flex gap-3"
    >
      {/* TIMELINE RAIL — drag handle + numbered badge, OUTSIDE the card. */}
      <div className="flex shrink-0 items-start gap-1.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          data-grip
          aria-label="Drag to reorder step"
          className="mt-2 cursor-grab touch-none text-ink-muted hover:text-ink active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <div className="relative w-9 self-stretch">
          {!isFirst && (
            <span
              aria-hidden
              className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-rule"
            />
          )}
          {!isLast && (
            <span
              aria-hidden
              className="absolute left-1/2 bottom-0 top-11 w-px -translate-x-1/2 bg-rule"
            />
          )}
          <span className="absolute left-0 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-chiclet border border-rule bg-card text-sm font-semibold text-ink-soft">
            {stepNumber}
          </span>
        </div>
      </div>

      {/* CARD — three zones split by faint dividers. */}
      <div
        onClick={activate}
        className={
          "relative flex flex-1 rounded-2xl border bg-card p-4 shadow-sm transition-colors " +
          (isActive
            ? "border-accent-soft/50"
            : "cursor-pointer border-rule hover:border-accent-soft/40")
        }
      >
        {/* ZONE A — photo + instruction/tip */}
        <div className="flex min-w-0 flex-1 gap-4">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="h-auto w-40 shrink-0 self-start rounded-2xl border border-rule object-contain"
            />
          )}

          <div className="min-w-0 flex-1 space-y-5">
            {instructionEditable ? (
              <div ref={instrEditorRef}>
                <AutoTextarea
                  value={step.instruction}
                  onChange={(v) => onChange({ instruction: v })}
                  placeholder="Describe this step…"
                  ariaLabel="Step instruction"
                  autoFocus
                  className="w-full rounded-lg border border-rule bg-inset px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent-soft focus:outline-none focus:ring-1 focus:ring-accent-soft/40"
                />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {step.instruction || (
                  <span className="text-ink-muted">No instruction yet.</span>
                )}
              </p>
            )}

            {showTipCallout && (
              <div className="flex gap-2 rounded-chiclet border border-rule bg-soft p-3">
                <Leaf
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 text-sm leading-relaxed">
                  <span className="font-semibold text-accent-ink">Tip</span>{" "}
                  {tipEditable ? (
                    <div ref={tipEditorRef} className="mt-1">
                      <AutoTextarea
                        value={step.tip}
                        onChange={(v) => onChange({ tip: v })}
                        placeholder="Add a tip…"
                        ariaLabel="Step tip"
                        autoFocus={step.tip === ""}
                        className="w-full bg-transparent leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap text-ink">
                      {step.tip}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* divider A | B */}
        <div aria-hidden className="mx-4 -my-1 w-px self-stretch bg-rule" />

        {/* ZONE B — timer (value / placeholder / inline editor) + buttons */}
        <div className="flex w-32 shrink-0 flex-col items-start gap-2">
          {timerOpen ? (
            // Inline timer editor — the number lives in the input; "min" is a
            // label beside it (mirrors the read-state "N min"), not inside the
            // field. Blur COMMITS and closes (empty → no timer). No spinners,
            // no clear button.
            <div className="inline-flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Timer minutes"
                autoFocus
                value={
                  step.timer_minutes === null ? "" : String(step.timer_minutes)
                }
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  onChange({
                    timer_minutes: digits === "" ? null : parseInt(digits, 10),
                  });
                }}
                onBlur={() => {
                  if (step.timer_minutes !== null && step.timer_minutes < 1) {
                    onChange({ timer_minutes: null });
                  }
                  setTimerOpen(false);
                }}
                style={{ width: "3.25rem" }}
                className="rounded-md border border-rule bg-inset px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-sm text-ink-soft">min</span>
            </div>
          ) : hasTimer ? (
            // Set-timer readout. Non-interactive in both states — the
            // "Edit timer" button (below) does the editing.
            <div className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
              <Clock className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
              <span>{step.timer_minutes} min</span>
            </div>
          ) : (
            // No timer: grey clock placeholder in read state so the zone has
            // visual purpose (in edit state the "Add timer" button covers it).
            !isActive && (
              <div
                className="inline-flex items-center text-ink-muted"
                aria-hidden
              >
                <Clock className="h-3.5 w-3.5" />
              </div>
            )
          )}

          {isActive && (
            <>
              {/* Always four buttons, fixed order. Labels flip Add↔Edit based
                  on whether the field has content; the buttons themselves never
                  appear, disappear, or move. */}
              <ActionButton
                icon={Clock}
                label={hasTimer ? "Edit timer" : "Add timer"}
                onClick={() => setTimerOpen(true)}
              />
              <ActionButton
                icon={Pencil}
                label="Edit step"
                onClick={openInstruction}
              />
              <ActionButton
                icon={Lightbulb}
                label={hasTip ? "Edit tip" : "Add tip"}
                onClick={openTip}
              />
              <ActionButton
                icon={ImagePlus}
                label={hasImage ? "Edit image" : "Add image"}
                disabled
                title="Image upload coming in Stage 4"
              />
            </>
          )}
        </div>

        {/* divider B | C */}
        <div aria-hidden className="mx-4 -my-1 w-px self-stretch bg-rule" />

        {/* ZONE C — trash */}
        <div className="shrink-0">
          <button
            type="button"
            aria-label="Delete step"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-ink-muted transition-colors hover:text-accent-ink"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
