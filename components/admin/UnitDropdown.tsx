"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { cellInputClass } from "./styles";

/**
 * The canonical unit list, grouped for the dropdown. The editor stores the
 * singular form; the public site will pluralize on display in a later
 * stage. Order and grouping match the agreed Stage 2B spec.
 */
const UNIT_GROUPS: { label: string; units: string[] }[] = [
  { label: "Weight", units: ["g", "kg", "oz", "lb"] },
  { label: "Volume", units: ["ml", "l", "tsp", "tbsp", "cup"] },
  { label: "Count", units: ["nos", "small", "medium", "large"] },
  {
    label: "Portions",
    units: ["pinch", "sprig", "bunch", "handful", "slice", "piece", "clove", "stick", "leaf"],
  },
  { label: "Special", units: ["to taste", "as needed"] },
];

const ALL_UNITS = UNIT_GROUPS.flatMap((g) => g.units);

/** Sentinels for the two non-unit options. */
const BLANK = "";
const CUSTOM = "__custom__";

/** The flat, keyboard-navigable list of option values (group headers excluded). */
const FLAT_OPTIONS: string[] = [BLANK, ...ALL_UNITS, CUSTOM];

export default function UnitDropdown({
  value,
  onChange,
  ariaLabel = "Unit",
}: {
  value: string;
  onChange: (unit: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // Custom mode shows a free-text input instead of the dropdown trigger.
  // Auto-enter it when the incoming value isn't a canonical unit (and isn't blank).
  const [customMode, setCustomMode] = useState(
    value !== BLANK && !ALL_UNITS.includes(value),
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const customRef = useRef<HTMLInputElement | null>(null);

  // Keep custom mode in sync if the value prop changes to a non-canonical one.
  useEffect(() => {
    if (value !== BLANK && !ALL_UNITS.includes(value)) setCustomMode(true);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const idx = FLAT_OPTIONS.indexOf(value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: globalThis.MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(option: string) {
    if (option === CUSTOM) {
      setCustomMode(true);
      setOpen(false);
      // Focus the text input on the next tick once it renders.
      setTimeout(() => customRef.current?.focus(), 0);
      return;
    }
    setCustomMode(false);
    onChange(option);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, FLAT_OPTIONS.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(FLAT_OPTIONS[highlight]);
    }
  }

  // --- Custom free-text mode ---
  if (customMode) {
    return (
      <div className="relative flex items-center">
        <input
          ref={customRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="custom unit"
          aria-label={`${ariaLabel} (custom)`}
          className={cellInputClass + " pr-7"}
        />
        <button
          type="button"
          aria-label="Back to unit list"
          title="Choose from the list instead"
          onClick={() => {
            // Returning to the list clears a non-canonical value so the
            // dropdown has a clean state; a canonical value is kept.
            if (!ALL_UNITS.includes(value)) onChange(BLANK);
            setCustomMode(false);
            setTimeout(() => buttonRef.current?.focus(), 0);
          }}
          className="absolute right-1.5 text-ink-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  // --- Dropdown mode ---
  const display = value === BLANK ? "—" : value;

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cellInputClass + " cursor-pointer pr-7 text-left"}
      >
        <span className={value === BLANK ? "text-ink-muted" : ""}>{display}</span>
      </button>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
      />
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-40 mt-1 max-h-72 w-40 overflow-auto rounded-lg border border-rule bg-card py-1 shadow-lg"
        >
          {/* Blank / no unit */}
          <Option
            label="— (no unit)"
            selected={value === BLANK}
            highlighted={highlight === FLAT_OPTIONS.indexOf(BLANK)}
            onHover={() => setHighlight(FLAT_OPTIONS.indexOf(BLANK))}
            onPick={() => choose(BLANK)}
          />

          {UNIT_GROUPS.map((group) => (
            <li key={group.label} role="presentation">
              <div className="mt-1 px-3 pb-0.5 pt-1 text-[10px] uppercase tracking-[0.12em] text-ink-muted/70">
                {group.label}
              </div>
              <ul role="presentation">
                {group.units.map((unit) => {
                  const idx = FLAT_OPTIONS.indexOf(unit);
                  return (
                    <Option
                      key={unit}
                      label={unit}
                      selected={value === unit}
                      highlighted={highlight === idx}
                      onHover={() => setHighlight(idx)}
                      onPick={() => choose(unit)}
                    />
                  );
                })}
              </ul>
            </li>
          ))}

          {/* Custom escape hatch — wrapped in its own <ul> so the <li>
              Option isn't an invalid direct child of another <li>. */}
          <li role="presentation" className="mt-1 border-t border-rule pt-1">
            <ul role="presentation">
              <Option
                label="Custom…"
                selected={false}
                highlighted={highlight === FLAT_OPTIONS.indexOf(CUSTOM)}
                onHover={() => setHighlight(FLAT_OPTIONS.indexOf(CUSTOM))}
                onPick={() => choose(CUSTOM)}
              />
            </ul>
          </li>
        </ul>
      )}
    </div>
  );
}

function Option({
  label,
  selected,
  highlighted,
  onHover,
  onPick,
}: {
  label: string;
  selected: boolean;
  highlighted: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected={selected}
      onMouseDown={(event) => {
        event.preventDefault();
        onPick();
      }}
      onMouseEnter={onHover}
      className={
        "cursor-pointer px-3 py-1.5 text-sm text-ink " +
        (highlighted ? "bg-background " : "") +
        (selected ? "font-medium text-accent-ink" : "")
      }
    >
      {label}
    </li>
  );
}
