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
  X,
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

/** A small chiclet action button used in the right-hand stack. These stay
 *  as buttons no matter what — they never morph into the value they set. */
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
 *    plain instruction text, optional read-only tip callout, optional timer
 *    readout, and a trash control. A faint hover outline hints it's clickable.
 *
 *  EDIT  (isActive) — clicking anywhere in the card activates it. A fixed
 *    column of four buttons appears (Add image / Add tip / Add timer /
 *    Edit step). Each button reveals an inline editor for its field; the
 *    buttons themselves never change. Re-clicking an already-open button
 *    does nothing. Editors close only when the parent clears `isActive`
 *    (on a successful Save) — never on a click outside.
 */
export default function StepCard({
  step,
  stepNumber,
  isActive,
  autoEdit,
  onActivate,
  onChange,
  onDelete,
}: {
  step: EditorStep;
  stepNumber: number;
  isActive: boolean;
  /** A freshly inserted step opens with its instruction editor pre-revealed
   *  and focused so the user can type immediately. */
  autoEdit: boolean;
  onActivate: () => void;
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

  // Per-field editor reveals. They only open (no toggle-closed); they're
  // forced shut when the card leaves the active state on save.
  const [instructionOpen, setInstructionOpen] = useState(autoEdit);
  const [tipOpen, setTipOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);

  // When the card leaves the active state (on save), force every editor shut
  // so a later re-activation starts clean. Adjusting state during render when
  // a prop changes is React's recommended alternative to a reset effect.
  const [wasActive, setWasActive] = useState(isActive);
  if (wasActive !== isActive) {
    setWasActive(isActive);
    if (!isActive) {
      setInstructionOpen(false);
      setTipOpen(false);
      setTimerOpen(false);
    }
  }

  const photoUrl = step.photos[0]?.url;
  const hasTip = step.tip.trim().length > 0;
  const hasTimer = step.timer_minutes !== null;

  // Tip callout: visible in read state only if it has content; in edit state
  // also once its editor is opened. Instruction is always shown (as text or,
  // when its editor is open, as an input).
  const showTipCallout = isActive ? hasTip || tipOpen : hasTip;
  const tipEditable = isActive && tipOpen;
  const instructionEditable = isActive && instructionOpen;

  function activate() {
    if (!isActive) onActivate();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={activate}
      // Every step has the SAME card weight — a warm cream fill (never white),
      // a gentle border, padding, and a whisper of elevation — whether or not
      // it has a tip/timer and whether or not it's active. Activating a card
      // does NOT change its background; the only visual cue is the slightly
      // firmer border (plus the four buttons that appear inside).
      className={
        "relative flex gap-4 rounded-2xl border bg-[#fdfaf4] p-4 shadow-sm transition-colors " +
        (isActive
          ? "border-accent-soft/50"
          : "cursor-pointer border-rule hover:border-accent-soft/40")
      }
    >
      {/* Drag handle — stop the click from also activating the card. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Drag to reorder step"
        onClick={(e) => e.stopPropagation()}
        className="mt-1 h-fit cursor-grab touch-none self-start text-ink-muted hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      {/* Numbered chiclet badge — a compact chapter mark at the card's
          top-left, beside the photo. self-start keeps it from stretching. */}
      <span className="mt-0.5 flex h-9 w-9 shrink-0 self-start items-center justify-center rounded-chiclet border border-rule bg-surface text-sm font-semibold text-ink-soft">
        {stepNumber}
      </span>

      {/* Step photo at its native aspect ratio (no square crop). */}
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="h-auto w-40 shrink-0 self-start rounded-2xl border border-rule object-contain"
        />
      )}

      {/* Instruction + tip */}
      <div className="min-w-0 flex-1 space-y-3">
        {instructionEditable ? (
          <AutoTextarea
            value={step.instruction}
            onChange={(v) => onChange({ instruction: v })}
            placeholder="Describe this step…"
            ariaLabel="Step instruction"
            autoFocus
            className="w-full rounded-lg border border-rule bg-background px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent-soft focus:outline-none focus:ring-1 focus:ring-accent-soft/40"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {step.instruction || (
              <span className="text-ink-muted">No instruction yet.</span>
            )}
          </p>
        )}

        {showTipCallout && (
          // A tender note, not a form field: soft warm fill, no border. The
          // terracotta accent lives only on the leaf icon and the "Tip" label;
          // the tip body is plain warm prose.
          <div className="flex gap-2 rounded-chiclet bg-accent-soft/20 p-3">
            <Leaf
              className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink"
              aria-hidden
            />
            <div className="min-w-0 flex-1 text-sm leading-relaxed">
              <span className="font-semibold text-accent-ink">Tip</span>{" "}
              {tipEditable ? (
                <AutoTextarea
                  value={step.tip}
                  onChange={(v) => onChange({ tip: v })}
                  placeholder="Add a tip…"
                  ariaLabel="Step tip"
                  autoFocus={step.tip === ""}
                  className="mt-1 w-full bg-transparent leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
                />
              ) : (
                <span className="whitespace-pre-wrap text-ink">{step.tip}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right-hand column: trash, timer readout, then the four buttons. */}
      <div className="flex w-32 shrink-0 flex-col items-end gap-2 self-start">
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

        {/* Timer readout — shows whenever a timer is set, sitting ABOVE the
            buttons. It never replaces the "Add timer" button. */}
        {hasTimer && (
          <div className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <Clock className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
            <span>{step.timer_minutes} min</span>
          </div>
        )}

        {isActive && (
          <>
            {/* Timer editor — fixed-width input that does not grow as digits
                are typed, plus a one-click clear back to "no timer". */}
            {timerOpen && (
              <div className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  aria-label="Timer minutes"
                  autoFocus={step.timer_minutes === null}
                  value={step.timer_minutes ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      onChange({ timer_minutes: null });
                      return;
                    }
                    const n = Math.max(1, Math.floor(Number(raw)));
                    onChange({ timer_minutes: Number.isFinite(n) ? n : null });
                  }}
                  style={{ width: "3.25rem" }}
                  className="shrink-0 rounded-md border border-rule bg-background px-2 py-1 text-right text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-xs text-ink-soft">min</span>
                <button
                  type="button"
                  aria-label="Clear timer"
                  title="Clear timer"
                  onClick={() => onChange({ timer_minutes: null })}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-rule text-ink-muted transition-colors hover:border-accent hover:text-accent-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}

            <ActionButton
              icon={ImagePlus}
              label="Add image"
              disabled
              title="Image upload coming in Stage 4"
            />
            <ActionButton
              icon={Lightbulb}
              label="Add tip"
              onClick={() => setTipOpen(true)}
            />
            <ActionButton
              icon={Clock}
              label="Add timer"
              onClick={() => setTimerOpen(true)}
            />
            <ActionButton
              icon={Pencil}
              label="Edit step"
              onClick={() => setInstructionOpen(true)}
            />
          </>
        )}
      </div>
    </div>
  );
}
