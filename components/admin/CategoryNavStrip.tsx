"use client";

import type { RefObject } from "react";
import type { AdminCategory } from "@/types/recipe";

/**
 * The sticky category navigation strip: one horizontal line of chips
 * ("Category Name (N)"), pinned below the admin header as the page scrolls.
 * Clicking a chip smooth-scrolls to that category; the active chip (the
 * top-most category currently under the strip) gets a terracotta accent.
 *
 * Overflow is horizontal scroll (never wraps) with a soft right-edge fade.
 * Sticky `top` is passed in (the measured admin-header height) so the strip
 * pins just beneath the header rather than colliding with it.
 */
export default function CategoryNavStrip({
  categories,
  activeSlug,
  onChipClick,
  top,
  innerRef,
}: {
  categories: AdminCategory[];
  activeSlug: string | null;
  onChipClick: (slug: string) => void;
  top: number;
  innerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={innerRef}
      style={{ top }}
      className="sticky z-10 -mx-4 mb-6 border-b border-rule bg-background sm:-mx-6"
    >
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => {
            const active = category.slug === activeSlug;
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => onChipClick(category.slug)}
                className={
                  "inline-flex shrink-0 items-center gap-1.5 rounded-chiclet border px-3 py-1.5 text-sm transition-colors " +
                  (active
                    ? "border-accent bg-accent-soft/15 font-semibold text-accent-ink"
                    : "border-transparent bg-[#efe7dd] text-ink-soft hover:text-ink")
                }
              >
                <span>{category.name}</span>
                <span className={active ? "text-accent" : "text-ink-muted"}>
                  {category.count}
                </span>
              </button>
            );
          })}
        </div>
        {/* Right-edge fade — hints there's more to scroll when chips overflow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
        />
      </div>
    </div>
  );
}
