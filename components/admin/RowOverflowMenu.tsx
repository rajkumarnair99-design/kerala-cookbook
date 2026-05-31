"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MoreHorizontal } from "lucide-react";
import type { AdminCategory } from "@/types/recipe";

/**
 * The per-row "…" actions menu. In 5b its only action is "Move to category":
 * a popover listing every OTHER category (the recipe's current one is
 * excluded), each with its live count. Selecting one calls onMove.
 *
 * Keyboard: the trigger opens on Enter/Space/↓; inside, ↑/↓ move the
 * highlight, Enter/Space selects, Esc closes (focus returns to the trigger),
 * and a click outside closes. Mirrors the editor's CategorySelect.
 */
export default function RowOverflowMenu({
  recipeTitle,
  currentCategorySlug,
  categories,
  onMove,
}: {
  recipeTitle: string;
  currentCategorySlug: string;
  categories: AdminCategory[];
  onMove: (targetSlug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const targets = categories.filter((c) => c.slug !== currentCategorySlug);

  useEffect(() => {
    if (open) setHighlight(0);
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on Escape regardless of where focus sits (belt-and-suspenders with
  // the wrapper's onKeyDown, which also handles arrow navigation).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(slug: string) {
    setOpen(false);
    buttonRef.current?.focus();
    onMove(slug);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, targets.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const t = targets[highlight];
      if (t) pick(t.slug);
    }
  }

  return (
    <div ref={wrapRef} className="relative shrink-0" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${recipeTitle}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-chiclet border border-rule text-ink-soft transition-colors hover:border-accent hover:text-accent-ink"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Move ${recipeTitle} to category`}
          className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-chiclet border border-rule bg-card py-1 shadow-lg"
        >
          <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Move to category
          </div>
          {targets.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-muted">
              No other categories yet
            </div>
          ) : (
            targets.map((category, index) => (
              <button
                key={category.slug}
                role="menuitem"
                type="button"
                // onMouseDown (not onClick) so the outside-click handler
                // doesn't close the menu before the choice registers.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(category.slug);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink " +
                  (index === highlight ? "bg-background" : "")
                }
              >
                <span className="truncate">{category.name}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {category.count}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
