"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { GripVertical, Pencil } from "lucide-react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import { reorderCategories, reorderRecipes, moveRecipe } from "@/app/admin/actions";
import AddCategoryControl from "./AddCategoryControl";
import CategoryNavStrip from "./CategoryNavStrip";
import CategorySection from "./CategorySection";

type Toast = { text: string; kind: "ok" | "error" };
type Snapshot = { catOrder: string[]; recipesByCat: Record<string, string[]> };

function estimateHeight(count: number): number {
  return 58 + count * 64;
}

function assignColumns(
  order: string[],
  heightOf: (slug: string) => number,
): Record<string, 0 | 1> {
  const out: Record<string, 0 | 1> = {};
  let h0 = 0;
  let h1 = 0;
  for (const slug of order) {
    const h = heightOf(slug);
    if (h0 <= h1) {
      out[slug] = 0;
      h0 += h;
    } else {
      out[slug] = 1;
      h1 += h;
    }
  }
  return out;
}

function sameAssignment(a: Record<string, 0 | 1>, b: Record<string, 0 | 1>) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

function bucketsFromProps(
  categories: AdminCategory[],
  recipes: RecipeSummary[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of categories) out[c.slug] = [];
  for (const r of recipes) (out[r.categorySlug] ??= []).push(r.slug);
  return out;
}

function cloneBuckets(b: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(b)) out[k] = [...b[k]];
  return out;
}

export default function AdminRecipeList({
  categories,
  recipes,
}: {
  categories: AdminCategory[];
  recipes: RecipeSummary[];
}) {
  // Lookups (from props).
  const catMap: Record<string, AdminCategory> = {};
  for (const c of categories) catMap[c.slug] = c;
  const recipeMap: Record<string, RecipeSummary> = {};
  for (const r of recipes) recipeMap[r.slug] = r;

  // Single logical order (optimistic local state; synced from props when idle).
  const [catOrder, setCatOrder] = useState<string[]>(() =>
    categories.map((c) => c.slug),
  );
  const [recipesByCat, setRecipesByCat] = useState<Record<string, string[]>>(
    () => bucketsFromProps(categories, recipes),
  );

  // Live category list (counts derived from local recipesByCat).
  const liveCategories: AdminCategory[] = catOrder
    .filter((slug) => catMap[slug])
    .map((slug) => ({
      ...catMap[slug],
      count: recipesByCat[slug]?.length ?? 0,
    }));

  // recipe slug → category slug (read by the collision detector via a ref).
  const recipeToCat: Record<string, string> = {};
  for (const slug of catOrder) {
    for (const r of recipesByCat[slug] ?? []) recipeToCat[r] = slug;
  }
  const recipeToCatRef = useRef(recipeToCat);
  recipeToCatRef.current = recipeToCat;

  // Drag + layout state.
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const stripRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const snapshotRef = useRef<Snapshot | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const [assignment, setAssignment] = useState<Record<string, 0 | 1>>(() =>
    assignColumns(
      categories.map((c) => c.slug),
      (slug) => estimateHeight(catMap[slug]?.count ?? 0),
    ),
  );
  const [measureNonce, setMeasureNonce] = useState(0);
  const [stickyTop, setStickyTop] = useState(0);
  const [activeSlug, setActiveSlug] = useState<string | null>(
    categories[0]?.slug ?? null,
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"category" | "recipe" | null>(
    null,
  );
  const [overCatSlug, setOverCatSlug] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const registerCard = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(slug, el);
    else cardRefs.current.delete(slug);
  }, []);

  // Sync local state from server props when not mid-drag (after a successful
  // action's revalidate, the new props equal our optimistic state).
  useEffect(() => {
    if (activeIdRef.current) return;
    setCatOrder(categories.map((c) => c.slug));
    setRecipesByCat(bucketsFromProps(categories, recipes));
  }, [categories, recipes]);

  // Toast auto-dismiss (errors linger longer; both can be clicked to dismiss).
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "ok" ? 3000 : 7000);
    return () => clearTimeout(t);
  }, [toast]);

  // Sticky offset = admin header height.
  useLayoutEffect(() => {
    const header = document.querySelector("header");
    if (header) setStickyTop((header as HTMLElement).offsetHeight);
  }, []);

  // Masonry — frozen while dragging (so cards never re-parent mid-gesture).
  useLayoutEffect(() => {
    if (activeDragId) return;
    const next = assignColumns(catOrder, (slug) => {
      const el = cardRefs.current.get(slug);
      return el ? el.offsetHeight : estimateHeight(recipesByCat[slug]?.length ?? 0);
    });
    setAssignment((prev) => (sameAssignment(prev, next) ? prev : next));
  }, [catOrder, recipesByCat, measureNonce, activeDragId]);

  // Re-measure on card resize (collapse/expand, etc.) — ignored while dragging.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (activeIdRef.current || rafRef.current) return;
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
  }, [catOrder]);

  // Window resize: refresh sticky offset + re-measure.
  useEffect(() => {
    const onResize = () => {
      const header = document.querySelector("header");
      if (header) setStickyTop((header as HTMLElement).offsetHeight);
      setMeasureNonce((n) => n + 1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Scroll-spy: active chip = top-most category under the sticky strip.
  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const stripBottom = stripRef.current
        ? stripRef.current.getBoundingClientRect().bottom
        : stickyTop;
      let best: string | null = null;
      let bestTop = -Infinity;
      for (const slug of catOrder) {
        const el = cardRefs.current.get(slug);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= stripBottom + 2 && top > bestTop) {
          bestTop = top;
          best = slug;
        }
      }
      setActiveSlug(best ?? catOrder[0] ?? null);
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
  }, [catOrder, stickyTop, measureNonce]);

  const scrollToCategory = useCallback(
    (slug: string) => {
      const el = cardRefs.current.get(slug);
      if (!el) return;
      const stripH = stripRef.current?.offsetHeight ?? 0;
      const y =
        el.getBoundingClientRect().top + window.scrollY - stickyTop - stripH - 12;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveSlug(slug);
    },
    [stickyTop],
  );

  /* -------------------- drag wiring -------------------- */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const id = String(args.active.id);
    if (id.startsWith("cat:")) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          String(c.id).startsWith("cat:"),
        ),
      });
    }
    const slug = id.slice("recipe:".length);
    const cat = recipeToCatRef.current[slug];
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => {
        const cid = String(c.id);
        return (
          cid.startsWith("recipe:") &&
          recipeToCatRef.current[cid.slice("recipe:".length)] === cat
        );
      }),
    });
  }, []);

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    activeIdRef.current = id;
    setActiveDragId(id);
    setActiveType(id.startsWith("cat:") ? "category" : "recipe");
    snapshotRef.current = {
      catOrder: [...catOrder],
      recipesByCat: cloneBuckets(recipesByCat),
    };
  }

  function onDragOver(e: DragOverEvent) {
    if (activeType !== "category") return;
    const over = e.over ? String(e.over.id) : null;
    setOverCatSlug(over && over.startsWith("cat:") ? over.slice(4) : null);
  }

  function endDrag() {
    activeIdRef.current = null;
    setActiveDragId(null);
    setActiveType(null);
    setOverCatSlug(null);
  }

  async function persistCategoryOrder(next: string[]) {
    const result = await reorderCategories(next);
    if (!result.ok) {
      if (snapshotRef.current) {
        setCatOrder(snapshotRef.current.catOrder);
        setRecipesByCat(snapshotRef.current.recipesByCat);
      }
      setToast({ text: `Couldn't save the change — ${result.error}`, kind: "error" });
    } else {
      setToast({ text: "Categories reordered", kind: "ok" });
    }
  }

  async function persistRecipeOrder(cat: string, nextList: string[]) {
    const result = await reorderRecipes([
      { categorySlug: cat, recipeSlugs: nextList },
    ]);
    if (!result.ok) {
      if (snapshotRef.current) {
        setCatOrder(snapshotRef.current.catOrder);
        setRecipesByCat(snapshotRef.current.recipesByCat);
      }
      setToast({ text: `Couldn't save the change — ${result.error}`, kind: "error" });
    } else {
      setToast({ text: "Order updated", kind: "ok" });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    endDrag();
    if (!overId) return; // dropped over nothing → no change

    if (id.startsWith("cat:")) {
      const a = id.slice(4);
      const o = overId.startsWith("cat:") ? overId.slice(4) : null;
      if (!o || a === o) return;
      const from = catOrder.indexOf(a);
      const to = catOrder.indexOf(o);
      if (from < 0 || to < 0 || from === to) return;
      const next = arrayMove(catOrder, from, to);
      setCatOrder(next);
      void persistCategoryOrder(next);
      return;
    }

    // recipe (within its own category only)
    const a = id.slice("recipe:".length);
    const o = overId.startsWith("recipe:") ? overId.slice("recipe:".length) : null;
    if (!o || a === o) return;
    const cat = recipeToCatRef.current[a];
    const list = recipesByCat[cat] ?? [];
    const from = list.indexOf(a);
    const to = list.indexOf(o);
    if (from < 0 || to < 0 || from === to) return;
    const nextList = arrayMove(list, from, to);
    setRecipesByCat({ ...recipesByCat, [cat]: nextList });
    void persistRecipeOrder(cat, nextList);
  }

  function onDragCancel() {
    endDrag(); // state was never mutated during the drag, so nothing to revert
  }

  // Menu-driven cross-category move.
  const handleMove = useCallback(
    (recipeSlug: string, targetSlug: string) => {
      const cat = recipeToCatRef.current[recipeSlug];
      if (!cat || cat === targetSlug) return;
      const snap: Snapshot = {
        catOrder: [...catOrder],
        recipesByCat: cloneBuckets(recipesByCat),
      };
      const next = cloneBuckets(recipesByCat);
      next[cat] = next[cat].filter((s) => s !== recipeSlug);
      next[targetSlug] = [...(next[targetSlug] ?? []), recipeSlug];
      setRecipesByCat(next);
      void moveRecipe(recipeSlug, targetSlug).then((result) => {
        if (!result.ok) {
          setRecipesByCat(snap.recipesByCat);
          setCatOrder(snap.catOrder);
          setToast({ text: `Couldn't move the recipe — ${result.error}`, kind: "error" });
        } else {
          setToast({
            text: `Moved to ${catMap[targetSlug]?.name ?? "category"}`,
            kind: "ok",
          });
        }
      });
    },
    // catMap/catOrder/recipesByCat read fresh each render; deps keep it current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catOrder, recipesByCat],
  );

  const leftColumn = catOrder.filter((slug) => assignment[slug] !== 1);
  const rightColumn = catOrder.filter((slug) => assignment[slug] === 1);

  const renderCategory = (slug: string) => {
    const category = liveCategories.find((c) => c.slug === slug);
    if (!category) return null;
    const recipeList = (recipesByCat[slug] ?? [])
      .map((rs) => recipeMap[rs])
      .filter(Boolean) as RecipeSummary[];
    return (
      <SortableCategory
        key={slug}
        category={category}
        recipes={recipeList}
        categories={liveCategories}
        onMove={handleMove}
        isDropTarget={activeType === "category" && overCatSlug === slug && activeDragId !== `cat:${slug}`}
        registerCard={registerCard}
        scrollMarginTop={stickyTop + 12}
      />
    );
  };

  const activeRecipe =
    activeType === "recipe" && activeDragId
      ? recipeMap[activeDragId.slice("recipe:".length)]
      : null;
  const activeCategory =
    activeType === "category" && activeDragId
      ? liveCategories.find((c) => `cat:${c.slug}` === activeDragId)
      : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">Recipes</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Click a recipe to edit. Drag to reorder.
          </p>
        </div>
        <AddCategoryControl onClick={() => undefined} />
      </div>

      <CategoryNavStrip
        categories={liveCategories}
        activeSlug={activeSlug}
        onChipClick={scrollToCategory}
        top={stickyTop}
        innerRef={stripRef}
      />

      <DndContext
        id="admin-recipe-dnd"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext
          items={catOrder.map((s) => `cat:${s}`)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-5">{leftColumn.map(renderCategory)}</div>
            <div className="flex flex-col gap-5">{rightColumn.map(renderCategory)}</div>
          </div>
        </SortableContext>

        <DragOverlay>
          {activeRecipe ? (
            <RecipeDragPreview recipe={activeRecipe} />
          ) : activeCategory ? (
            <CategoryDragPreview category={activeCategory} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4">
          <button
            type="button"
            onClick={() => setToast(null)}
            className={
              "rounded-chiclet px-4 py-3 text-left text-sm text-white shadow-lg " +
              (toast.kind === "ok" ? "bg-accent" : "bg-ink")
            }
          >
            {toast.kind === "ok" ? "✓ " : "⚠ "}
            {toast.text}
          </button>
        </div>
      )}
    </div>
  );
}

/** A category card wired as a sortable; the grip is the drag activator and the
 *  card itself stays put during a drag (no-live-shuffle — the DragOverlay
 *  floats the copy and the masonry rebalances on drop). */
function SortableCategory({
  category,
  recipes,
  categories,
  onMove,
  isDropTarget,
  registerCard,
  scrollMarginTop,
}: {
  category: AdminCategory;
  recipes: RecipeSummary[];
  categories: AdminCategory[];
  onMove: (recipeSlug: string, targetSlug: string) => void;
  isDropTarget: boolean;
  registerCard: (slug: string, el: HTMLElement | null) => void;
  scrollMarginTop: number;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } =
    useSortable({ id: `cat:${category.slug}` });

  const grip = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label={`Drag to reorder ${category.name}`}
      className="flex shrink-0 cursor-grab touch-none items-center text-ink-muted hover:text-ink active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        registerCard(category.slug, el);
      }}
      id={`category-${category.slug}`}
      style={{ scrollMarginTop, opacity: isDragging ? 0.4 : undefined }}
    >
      <CategorySection
        category={category}
        recipes={recipes}
        categories={categories}
        onMove={onMove}
        dragHandle={grip}
        isDropTarget={isDropTarget}
      />
    </div>
  );
}

/** Floating preview of a dragged recipe row. */
function RecipeDragPreview({ recipe }: { recipe: RecipeSummary }) {
  return (
    <div className="flex w-[520px] max-w-[80vw] items-center gap-3 rounded-2xl border border-accent-soft bg-card px-3 py-2 shadow-xl">
      <GripVertical className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-chiclet border border-rule bg-soft text-ink-muted">
        <Pencil className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{recipe.title}</span>
        <span className="block truncate text-xs text-ink-muted">
          {recipe.author ?? "no author yet"}
        </span>
      </span>
    </div>
  );
}

/** Floating preview of a dragged category card (compact header only). */
function CategoryDragPreview({ category }: { category: AdminCategory }) {
  return (
    <div className="flex w-[420px] max-w-[80vw] items-center gap-3 rounded-2xl border border-accent-soft bg-card px-4 py-3 shadow-xl">
      <GripVertical className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="font-serif text-xl text-ink">{category.name}</span>
      <span className="text-xs text-ink-muted">
        {category.count} {category.count === 1 ? "recipe" : "recipes"}
      </span>
    </div>
  );
}
