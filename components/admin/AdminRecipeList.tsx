"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import AddCategoryControl from "./AddCategoryControl";
import CategoryNavStrip from "./CategoryNavStrip";
import CategorySection from "./CategorySection";

/** Rough height estimate for the first (server/pre-measure) render, so the
 *  initial column split is sensible before useLayoutEffect measures for real.
 *  Row heights are fixed, so this is close to the measured value. */
function estimateHeight(category: AdminCategory): number {
  const HEADER = 58;
  const ROW = 64;
  return HEADER + category.count * ROW;
}

/** Shortest-column assignment: walk categories in sort_order, drop each into
 *  whichever column is currently shorter (ties → left). Returns slug → 0|1. */
function assignColumns(
  categories: AdminCategory[],
  heightOf: (c: AdminCategory) => number,
): Record<string, 0 | 1> {
  const out: Record<string, 0 | 1> = {};
  let h0 = 0;
  let h1 = 0;
  for (const c of categories) {
    const h = heightOf(c);
    if (h0 <= h1) {
      out[c.slug] = 0;
      h0 += h;
    } else {
      out[c.slug] = 1;
      h1 += h;
    }
  }
  return out;
}

function sameAssignment(
  a: Record<string, 0 | 1>,
  b: Record<string, 0 | 1>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

/**
 * The admin recipe list: a 2-column masonry grid of category cards with a
 * sticky category nav strip. Categories flow in sort_order, each dropped into
 * the shorter column (JS masonry — recomputed before paint and on any card
 * resize, e.g. collapse/expand). The masonry is purely presentational; the
 * single logical order is `categories` (sort_order), which the drag in 5b will
 * operate on.
 */
export default function AdminRecipeList({
  categories,
  recipes,
}: {
  categories: AdminCategory[];
  recipes: RecipeSummary[];
}) {
  // Bucket recipes by category (already ordered by category, sort_order).
  const byCategory = new Map<string, RecipeSummary[]>();
  for (const recipe of recipes) {
    const bucket = byCategory.get(recipe.categorySlug) ?? [];
    bucket.push(recipe);
    byCategory.set(recipe.categorySlug, bucket);
  }

  // Card DOM nodes, keyed by slug — used for both masonry measurement and
  // scroll-spy / scroll-to.
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const stripRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  // Column assignment (slug → 0|1). Initialised from estimates so the very
  // first paint is already a sensible split; refined by real measurement.
  const [assignment, setAssignment] = useState<Record<string, 0 | 1>>(() =>
    assignColumns(categories, estimateHeight),
  );
  // Bumped to force a re-measure (card resize / window resize).
  const [measureNonce, setMeasureNonce] = useState(0);
  // The admin header's height, so the strip pins just beneath it.
  const [stickyTop, setStickyTop] = useState(0);
  const [activeSlug, setActiveSlug] = useState<string | null>(
    categories[0]?.slug ?? null,
  );

  const registerCard = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(slug, el);
    else cardRefs.current.delete(slug);
  }, []);

  // Measure the admin header height (the strip's sticky offset).
  useLayoutEffect(() => {
    const header = document.querySelector("header");
    if (header) setStickyTop((header as HTMLElement).offsetHeight);
  }, []);

  // Masonry: measure real card heights before paint and re-split if needed.
  useLayoutEffect(() => {
    const next = assignColumns(categories, (c) => {
      const el = cardRefs.current.get(c.slug);
      return el ? el.offsetHeight : estimateHeight(c);
    });
    setAssignment((prev) => (sameAssignment(prev, next) ? prev : next));
  }, [categories, measureNonce]);

  // Re-measure when any card resizes (collapse/expand, image load, …).
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setMeasureNonce((n) => n + 1);
      });
    });
    for (const el of cardRefs.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [categories]);

  // Window resize: re-measure and refresh the sticky offset.
  useEffect(() => {
    const onResize = () => {
      const header = document.querySelector("header");
      if (header) setStickyTop((header as HTMLElement).offsetHeight);
      setMeasureNonce((n) => n + 1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Scroll-spy: active = the top-most category whose card top has crossed
  // under the bottom of the sticky strip.
  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const stripBottom = stripRef.current
        ? stripRef.current.getBoundingClientRect().bottom
        : stickyTop;
      let best: string | null = null;
      let bestTop = -Infinity;
      for (const c of categories) {
        const el = cardRefs.current.get(c.slug);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= stripBottom + 2 && top > bestTop) {
          bestTop = top;
          best = c.slug;
        }
      }
      setActiveSlug(best ?? categories[0]?.slug ?? null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [categories, stickyTop, measureNonce]);

  const scrollToCategory = useCallback(
    (slug: string) => {
      const el = cardRefs.current.get(slug);
      if (!el) return;
      const stripH = stripRef.current?.offsetHeight ?? 0;
      const y =
        el.getBoundingClientRect().top + window.scrollY - stickyTop - stripH - 12;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveSlug(slug); // snappy: highlight immediately
    },
    [stickyTop],
  );

  const renderCard = (category: AdminCategory) => (
    <div
      key={category.slug}
      id={`category-${category.slug}`}
      ref={(el) => registerCard(category.slug, el)}
      style={{ scrollMarginTop: stickyTop + 12 }}
    >
      <CategorySection
        category={category}
        recipes={byCategory.get(category.slug) ?? []}
      />
    </div>
  );

  const leftColumn = categories.filter((c) => assignment[c.slug] !== 1);
  const rightColumn = categories.filter((c) => assignment[c.slug] === 1);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      {/* Page heading row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">Recipes</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Click a recipe to edit. Drag to reorder.
          </p>
        </div>
        <AddCategoryControl onClick={() => undefined} />
      </div>

      {/* Sticky category nav strip */}
      <CategoryNavStrip
        categories={categories}
        activeSlug={activeSlug}
        onChipClick={scrollToCategory}
        top={stickyTop}
        innerRef={stripRef}
      />

      {/* 2-column masonry grid */}
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-5">{leftColumn.map(renderCard)}</div>
        <div className="flex flex-col gap-5">{rightColumn.map(renderCard)}</div>
      </div>
    </div>
  );
}
