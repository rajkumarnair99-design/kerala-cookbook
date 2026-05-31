"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
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
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { AdminCategory, RecipeSummary } from "@/types/recipe";
import {
  addCategory,
  deleteCategory,
  moveRecipe,
  renameCategory,
  reorderCategories,
  reorderRecipes,
} from "@/app/admin/actions";
import AdminSidebar, { type ViewMode } from "./AdminSidebar";
import CategorySection from "./CategorySection";
import ConfirmDialog from "./ConfirmDialog";
import RowOverflowMenu from "./RowOverflowMenu";

type Toast = { text: string; kind: "ok" | "error" };
type Snapshot = { catOrder: string[]; recipesByCat: Record<string, string[]> };

const VIEW_KEY = "admin-view-mode";

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
  const catMap: Record<string, AdminCategory> = {};
  for (const c of categories) catMap[c.slug] = c;
  const recipeMap: Record<string, RecipeSummary> = {};
  for (const r of recipes) recipeMap[r.slug] = r;

  const [catOrder, setCatOrder] = useState<string[]>(() =>
    categories.map((c) => c.slug),
  );
  const [recipesByCat, setRecipesByCat] = useState<Record<string, string[]>>(
    () => bucketsFromProps(categories, recipes),
  );
  // Local display names — lets rename be optimistic and lets a just-added
  // category (not yet in props) render with its server-returned name.
  const [catNames, setCatNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.slug, c.name])),
  );

  // Live categories (name + count derived from local state, so they update
  // immediately on rename / move / add).
  const liveCategories: AdminCategory[] = catOrder
    .map((slug) => ({
      slug,
      name: catNames[slug] ?? catMap[slug]?.name ?? slug,
      sortOrder: catMap[slug]?.sortOrder ?? 0,
      count: recipesByCat[slug]?.length ?? 0,
    }));

  // recipe slug → category slug (current).
  const recipeToCat: Record<string, string> = {};
  for (const slug of catOrder) {
    for (const r of recipesByCat[slug] ?? []) recipeToCat[r] = slug;
  }
  const recipeToCatRef = useRef(recipeToCat);
  recipeToCatRef.current = recipeToCat;

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scrollRef = useRef<HTMLElement | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const pendingScrollRef = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("byCategory");
  const [activeSlug, setActiveSlug] = useState<string | null>(
    categories[0]?.slug ?? null,
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"category" | "recipe" | null>(
    null,
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const registerCard = useCallback((slug: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(slug, el);
    else cardRefs.current.delete(slug);
  }, []);

  // Persisted view mode (read before paint to avoid a flash; default byCategory).
  useLayoutEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "alphabetical" || v === "byCategory") setViewMode(v);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  // Sync local state from server props when idle (post-revalidate).
  useEffect(() => {
    if (activeIdRef.current) return;
    setCatOrder(categories.map((c) => c.slug));
    setRecipesByCat(bucketsFromProps(categories, recipes));
    setCatNames(Object.fromEntries(categories.map((c) => [c.slug, c.name])));
  }, [categories, recipes]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "ok" ? 3000 : 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const scrollToCategory = useCallback((slug: string) => {
    const el = cardRefs.current.get(slug);
    const main = scrollRef.current;
    if (!el || !main) return;
    const top =
      el.getBoundingClientRect().top -
      main.getBoundingClientRect().top +
      main.scrollTop -
      12;
    main.scrollTo({ top, behavior: "smooth" });
    setActiveSlug(slug);
  }, []);

  // Jump-nav: in alphabetical mode, switch to by-category first, then scroll.
  const jumpToCategory = useCallback(
    (slug: string) => {
      if (viewMode === "alphabetical") {
        pendingScrollRef.current = slug;
        setViewMode("byCategory");
      } else {
        scrollToCategory(slug);
      }
    },
    [viewMode, scrollToCategory],
  );
  useLayoutEffect(() => {
    if (viewMode === "byCategory" && pendingScrollRef.current) {
      const slug = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => scrollToCategory(slug));
    }
  }, [viewMode, scrollToCategory]);

  // Scroll-spy → sidebar active category (by-category mode only).
  useEffect(() => {
    if (viewMode !== "byCategory") return;
    const main = scrollRef.current;
    if (!main) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const mtop = main.getBoundingClientRect().top;
      let best: string | null = catOrder[0] ?? null;
      let bestTop = -Infinity;
      for (const slug of catOrder) {
        const el = cardRefs.current.get(slug);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - mtop;
        if (top <= 8 && top > bestTop) {
          bestTop = top;
          best = slug;
        }
      }
      setActiveSlug(best);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    compute();
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [viewMode, catOrder]);

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

  function endDrag() {
    activeIdRef.current = null;
    setActiveDragId(null);
    setActiveType(null);
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
    if (!overId) return;

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
    endDrag();
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catOrder, recipesByCat],
  );

  // Add a category. Not pre-optimistic (the unique slug is computed server-
  // side); on success we insert the server-returned category immediately so it
  // appears without waiting for the revalidate round-trip.
  const handleAddCategory = useCallback(
    async (name: string): Promise<boolean> => {
      const result = await addCategory(name);
      if (result.ok) {
        const c = result.category;
        setCatOrder((prev) => (prev.includes(c.slug) ? prev : [...prev, c.slug]));
        setCatNames((prev) => ({ ...prev, [c.slug]: c.name }));
        setRecipesByCat((prev) =>
          prev[c.slug] ? prev : { ...prev, [c.slug]: [] },
        );
        setToast({ text: "Category added", kind: "ok" });
        return true;
      }
      setToast({ text: `Couldn't add the category — ${result.error}`, kind: "error" });
      return false;
    },
    [],
  );

  // Rename — optimistic on the local display name; revert on failure.
  const handleRename = useCallback(
    (slug: string, newName: string) => {
      const prevName = catNames[slug] ?? catMap[slug]?.name ?? slug;
      if (newName === prevName) return;
      setCatNames((prev) => ({ ...prev, [slug]: newName }));
      void renameCategory(slug, newName).then((result) => {
        if (!result.ok) {
          setCatNames((prev) => ({ ...prev, [slug]: prevName }));
          setToast({ text: `Couldn't rename the category — ${result.error}`, kind: "error" });
        } else {
          setToast({ text: "Category renamed", kind: "ok" });
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catNames],
  );

  // Delete (confirmed) — optimistic removal; revert on failure. The `deleting`
  // guard means rapid double-confirms only fire once.
  function handleDeleteConfirmed(category: AdminCategory) {
    if (deleting) return;
    setDeleting(true);
    const snapOrder = [...catOrder];
    const snapRecipes = cloneBuckets(recipesByCat);
    const snapNames = { ...catNames };
    setCatOrder((prev) => prev.filter((s) => s !== category.slug));
    setPendingDelete(null);
    void deleteCategory(category.slug).then((result) => {
      setDeleting(false);
      if (!result.ok) {
        setCatOrder(snapOrder);
        setRecipesByCat(snapRecipes);
        setCatNames(snapNames);
        setToast({ text: `Couldn't delete the category — ${result.error}`, kind: "error" });
      } else {
        setToast({ text: "Category deleted", kind: "ok" });
      }
    });
  }

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
        onRename={handleRename}
        onRequestDelete={setPendingDelete}
        registerCard={registerCard}
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

  // Flat alphabetical list (by title across all categories).
  const alphabetical = catOrder
    .flatMap((slug) => recipesByCat[slug] ?? [])
    .map((s) => recipeMap[s])
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title)) as RecipeSummary[];

  return (
    <div className="flex min-h-0 flex-1">
      <AdminSidebar
        categories={liveCategories}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeSlug={viewMode === "byCategory" ? activeSlug : null}
        onCategoryClick={jumpToCategory}
        onAddCategory={handleAddCategory}
      />

      <main ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6">
            <h1 className="font-serif text-3xl text-ink">Recipes</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {viewMode === "byCategory"
                ? "Click a recipe to edit. Drag to reorder."
                : "Click a recipe to edit."}
            </p>
          </div>

          {viewMode === "byCategory" ? (
            <DndContext
              id="admin-recipe-dnd"
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              <SortableContext
                items={catOrder.map((s) => `cat:${s}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-4">
                  {catOrder.map(renderCategory)}
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
          ) : (
            <div className="rounded-2xl border border-rule bg-card px-3 py-2">
              <div className="divide-y divide-rule/50">
                {alphabetical.map((r) => (
                  <AlphabeticalRow
                    key={r.slug}
                    recipe={r}
                    categoryName={
                      catNames[recipeToCat[r.slug]] ??
                      catMap[recipeToCat[r.slug]]?.name ??
                      ""
                    }
                    categories={liveCategories}
                    onMove={handleMove}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete “${pendingDelete.name}”?` : ""}
        message="This cannot be undone. The category will be permanently removed."
        confirmLabel="Delete category"
        initialFocus="cancel"
        onConfirm={() => {
          if (pendingDelete) handleDeleteConfirmed(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

/** Category card as a vertical sortable (live reflow); grip is the activator. */
function SortableCategory({
  category,
  recipes,
  categories,
  onMove,
  onRename,
  onRequestDelete,
  registerCard,
}: {
  category: AdminCategory;
  recipes: RecipeSummary[];
  categories: AdminCategory[];
  onMove: (recipeSlug: string, targetSlug: string) => void;
  onRename: (slug: string, newName: string) => void;
  onRequestDelete: (category: AdminCategory) => void;
  registerCard: (slug: string, el: HTMLElement | null) => void;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `cat:${category.slug}` });

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
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        scrollMarginTop: 12,
        opacity: isDragging ? 0.4 : undefined,
      }}
    >
      <CategorySection
        category={category}
        recipes={recipes}
        categories={categories}
        onMove={onMove}
        onRename={onRename}
        onRequestDelete={onRequestDelete}
        dragHandle={grip}
      />
    </div>
  );
}

/** A row in the flat alphabetical view: thumbnail · title · category (right) ·
 *  "…" menu. No drag handle. */
function AlphabeticalRow({
  recipe,
  categoryName,
  categories,
  onMove,
}: {
  recipe: RecipeSummary;
  categoryName: string;
  categories: AdminCategory[];
  onMove: (recipeSlug: string, targetSlug: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <Link
        href={`/admin/recipes/${recipe.slug}/edit`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-chiclet px-2 py-1.5 transition-colors hover:bg-soft"
      >
        {recipe.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.heroImageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-chiclet border border-rule object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-chiclet border border-rule bg-soft text-ink-muted">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-medium text-ink">
          {recipe.title}
        </span>
        <span className="shrink-0 text-xs text-ink-muted">{categoryName}</span>
      </Link>
      <RowOverflowMenu
        recipeTitle={recipe.title}
        currentCategorySlug={recipe.categorySlug}
        categories={categories}
        onMove={(targetSlug) => onMove(recipe.slug, targetSlug)}
      />
    </div>
  );
}

function RecipeDragPreview({ recipe }: { recipe: RecipeSummary }) {
  return (
    <div className="flex max-w-[80vw] items-center gap-3 rounded-2xl border border-accent-soft bg-card px-3 py-2 shadow-xl">
      <GripVertical className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="font-medium text-ink">{recipe.title}</span>
    </div>
  );
}

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
