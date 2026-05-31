"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Camera,
  ChevronDown,
  FileText,
  LayoutGrid,
  ListChecks,
  Pencil,
  Soup,
  Video,
  X,
} from "lucide-react";
import type {
  Category,
  EditorIngredient,
  EditorRecipe,
  EditorSection,
  EditorStep,
  SaveResult,
} from "@/types/recipe";
import IngredientsEditor from "./IngredientsEditor";
import StepsEditor from "./StepsEditor";

/** Shared input styling — matches the public site's warm, minimal form look. */
const inputClass =
  "w-full rounded-lg border border-rule bg-inset px-3 py-2 text-ink " +
  "placeholder:text-ink-muted focus:outline-none focus:border-accent " +
  "focus:ring-1 focus:ring-accent";

/** Per-field character caps. */
const TAGLINE_MAX = 120;
const STORY_MAX = 600;
const NOTES_MAX = 2000;

function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * The four editor sections. Overview (2A) and Kitchen Notes are built;
 * Ingredients (2B) and Steps (2D) render a placeholder until their stage
 * is implemented.
 *
 * Icons come from lucide-react — see TabIcon below for the mapping.
 */
const TABS = [
  { id: "overview", label: "Overview", stage: null },
  { id: "ingredients", label: "Ingredients", stage: "2B" },
  { id: "steps", label: "Steps", stage: "2D" },
  { id: "notes", label: "Kitchen Notes", stage: null },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Toast = { text: string; kind: "ok" | "error" };

export default function RecipeEditor({
  recipe: initialRecipe,
  categories,
  saveAction,
}: {
  recipe: EditorRecipe;
  categories: Category[];
  saveAction: (recipe: EditorRecipe) => Promise<SaveResult>;
}) {
  const [recipe, setRecipe] = useState<EditorRecipe>(initialRecipe);
  const [tagsText, setTagsText] = useState(initialRecipe.tags.join(", "));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  // Bumped on every successful save. StepsEditor watches it to return all
  // steps to read state and close any revealed editors.
  const [savedNonce, setSavedNonce] = useState(0);

  // View-first / edit-on-click state for the two single-form tabs (mirrors
  // the Steps and Ingredients pattern). Each flag is independent of activeTab,
  // so a sticky-edited tab stays in edit state across tab switches.
  const [overviewEditing, setOverviewEditing] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);

  // The scrolling tab-content area. "Outside" (for click-to-deactivate) means
  // anywhere NOT inside this element — the sidebar nav, the leaf/footer, and
  // the top bar all live outside it.
  const tabContentRef = useRef<HTMLElement | null>(null);

  // Snapshot of each tab's editable values at the moment it entered edit mode.
  // "Real edits" is current-vs-baseline: an activation with no subsequent
  // change is not sticky and returns to read state on an outside click.
  const overviewBaselineRef = useRef({
    title: initialRecipe.title,
    subtitle: initialRecipe.subtitle,
    author: initialRecipe.author,
    source: initialRecipe.source,
    tags: initialRecipe.tags.join(", "),
    category_slug: initialRecipe.category_slug,
    serves: initialRecipe.serves,
    story: initialRecipe.story,
  });
  const notesBaselineRef = useRef(initialRecipe.notes);

  // Refresh each baseline on the inactive→active edge. Ref writes belong in an
  // effect, not in render.
  useEffect(() => {
    if (overviewEditing) {
      overviewBaselineRef.current = {
        title: recipe.title,
        subtitle: recipe.subtitle,
        author: recipe.author,
        source: recipe.source,
        tags: tagsText,
        category_slug: recipe.category_slug,
        serves: recipe.serves,
        story: recipe.story,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewEditing]);

  useEffect(() => {
    if (notesEditing) notesBaselineRef.current = recipe.notes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesEditing]);

  const overviewHasRealEdits = () => {
    const b = overviewBaselineRef.current;
    return (
      recipe.title !== b.title ||
      recipe.subtitle !== b.subtitle ||
      recipe.author !== b.author ||
      recipe.source !== b.source ||
      tagsText !== b.tags ||
      recipe.category_slug !== b.category_slug ||
      recipe.serves !== b.serves ||
      recipe.story !== b.story
    );
  };

  const notesHasRealEdits = () => recipe.notes !== notesBaselineRef.current;

  // Outside-click deactivation. "Outside" is tight (mirrors Steps/Ingredients,
  // where the cream space between cards deactivates an unedited item): only a
  // click on an editable control — or the open Category popover — keeps edit
  // mode. A click on the heading, subtitle, a label-less gap, the cream space
  // between fields, the image, the footer, or the sidebar returns the tab to
  // read state UNLESS it has real edits (then it stays sticky until Save).
  // Because the guard is hasRealEdits, switching tabs while genuinely editing
  // never deactivates — the sidebar click keeps it open.
  useEffect(() => {
    if (!overviewEditing) return;
    const onDown = (e: globalThis.MouseEvent) => {
      const root = tabContentRef.current;
      const target = e.target as HTMLElement | null;
      if (!root || !target) return;
      // Inside the tab AND on an editable control (input/textarea/button —
      // incl. the Category trigger and Change-image button — a field's wrapping
      // <label>, or the open Category listbox) keeps edit mode. The
      // root.contains guard scopes this to the tab, so the top-bar and sidebar
      // buttons still count as outside.
      if (
        root.contains(target) &&
        target.closest('input, textarea, button, label, [role="listbox"]')
      ) {
        return;
      }
      if (!overviewHasRealEdits()) setOverviewEditing(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // Field values are read live by the closure; list them so it stays current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    overviewEditing,
    recipe.title,
    recipe.subtitle,
    recipe.author,
    recipe.source,
    tagsText,
    recipe.category_slug,
    recipe.serves,
    recipe.story,
  ]);

  useEffect(() => {
    if (!notesEditing) return;
    const onDown = (e: globalThis.MouseEvent) => {
      const root = tabContentRef.current;
      const target = e.target as HTMLElement | null;
      if (!root || !target) return;
      // Same tight scope as Overview: only the textarea (or any editable
      // control) keeps edit mode. Clicking the card padding, the heading, or
      // any cream space returns to read state unless there are real edits.
      if (
        root.contains(target) &&
        target.closest('input, textarea, button, label, [role="listbox"]')
      ) {
        return;
      }
      if (!notesHasRealEdits()) setNotesEditing(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesEditing, recipe.notes]);

  // Warn before leaving (tab close, refresh, external nav) with edits pending.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.kind === "ok" ? 3500 : 7000,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  function updateField<K extends keyof EditorRecipe>(
    key: K,
    value: EditorRecipe[K],
  ) {
    setRecipe((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  // The Ingredients tab edits two related arrays at once (sections +
  // ingredients), so it gets its own setter rather than two updateField calls.
  function updateIngredients(
    sections: EditorSection[],
    ingredients: EditorIngredient[],
  ) {
    setRecipe((current) => ({ ...current, sections, ingredients }));
    setDirty(true);
  }

  function updateSteps(steps: EditorStep[]) {
    setRecipe((current) => ({ ...current, steps }));
    setDirty(true);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const toSave: EditorRecipe = { ...recipe, tags: parseTags(tagsText) };
    const result = await saveAction(toSave);
    setSaving(false);

    if (result.ok) {
      setRecipe(result.recipe);
      setTagsText(result.recipe.tags.join(", "));
      setDirty(false);
      setSavedNonce((n) => n + 1);
      // Both single-form tabs return to read state on a successful save; their
      // baselines reset when they next enter edit mode.
      setOverviewEditing(false);
      setNotesEditing(false);
      setToast({ text: "Recipe saved.", kind: "ok" });
    } else {
      setToast({ text: result.error, kind: "error" });
    }
  }

  function guardLeave(event: MouseEvent<HTMLAnchorElement>) {
    if (
      dirty &&
      !window.confirm("You have unsaved changes. Leave without saving?")
    ) {
      event.preventDefault();
    }
  }

  return (
    // Fixed-height shell: the page itself never scrolls. The top bar stays
    // put, the left sidebar stays put, and only the content column scrolls.
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar — spans the full width, above the left nav and content */}
      <header className="z-20 border-b border-rule bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Close + recipe identity */}
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/admin"
              onClick={guardLeave}
              aria-label="Close editor"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chiclet border border-rule text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              <X className="h-4 w-4" aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
                Edit recipe
              </div>
              <div className="truncate font-serif text-lg text-ink">
                {recipe.title || "Untitled recipe"}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              disabled
              title="Video isn't wired up yet"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink-muted"
            >
              <Video className="h-4 w-4" aria-hidden />
              Video
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save recipe"}
            </button>
          </div>
        </div>
      </header>

      {/* Body — vertical left nav + content area. min-h-0 lets the two
          columns own their own scroll instead of growing the page. */}
      <div className="flex min-h-0 flex-1">
        {/* Left nav — the four editor sections, plus a footer wordmark
            pinned to the bottom (shown on every tab). It stays put while the
            content scrolls; overflow-y-auto lets it scroll internally on a
            short screen so the footer is never cut off. */}
        <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-rule">
          <nav aria-label="Editor sections" className="flex flex-col py-3">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={
                    "relative flex items-center gap-3 px-5 py-2.5 text-left " +
                    "text-sm font-medium transition-colors " +
                    (active
                      ? "text-accent-ink"
                      : "text-ink-muted hover:text-ink")
                  }
                >
                  <TabIcon id={tab.id} />
                  <span>{tab.label}</span>
                  {active && (
                    <span
                      aria-hidden
                      className="absolute right-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-l bg-accent"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer — leaf illustration + collection wordmark. mt-auto pins
              it to the bottom of the full-height sidebar. Decorative, so the
              image is aria-hidden. */}
          <div className="mt-auto px-5 pb-10 pt-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/leaf-illustration.png"
              alt=""
              aria-hidden
              className="mb-3 h-auto w-40 opacity-85"
            />
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              Family Recipe Collection
            </div>
            <div className="mt-0.5 font-serif text-sm text-ink-soft">
              Good Food at Home
            </div>
          </div>
        </aside>

        {/* Content area — the only scrolling region; fills the remaining
            width. tabContentRef scopes outside-click detection: anything not
            inside this element (sidebar, footer, top bar) is "outside". */}
        <main
          ref={tabContentRef}
          className="min-w-0 flex-1 overflow-y-auto px-5 pb-12 sm:px-8"
        >
          {/* Overview tab (2A) — image, story, and the core text fields.
              Notes, ingredients, steps, and hero_image_url are intentionally
              NOT exposed here; they stay in `recipe` state and are written
              back unchanged on save. Story IS edited by this tab. */}
          {activeTab === "overview" && (
            <>
              {/* Header strip — heading + subtitle on the left; the edit
                  trigger (pencil chiclet + "Click to edit") on the right,
                  read state only. Mirrors Ingredients' helper-text placement. */}
              <div className="mt-8 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-medium text-ink">
                    Recipe overview
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Update the basic details about your recipe.
                    <br />
                    Press <span className="font-semibold">Save recipe</span>{" "}
                    when you are done.
                  </p>
                </div>
                {!overviewEditing && (
                  <EditTrigger
                    ariaLabel="Edit overview"
                    onClick={() => setOverviewEditing(true)}
                  />
                )}
              </div>

              {overviewEditing ? (
                /* EDIT — the full two-column form. Proportions (1fr_2fr ≈
                   33/67) measured from the mockup. The right column sets the
                   row height via its seven fields; the left column stretches
                   to match and its Story box absorbs the extra space (flex-1)
                   so the columns end at the same baseline. */
                <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-[1fr_2fr]">
                  <div className="flex flex-col gap-6">
                    <HeroImage url={recipe.hero_image_url} editable />

                    {/* Story — single text area, writes to recipes.story. */}
                    <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-rule bg-card p-4">
                      <div className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                        Story
                      </div>
                      <textarea
                        value={recipe.story}
                        onChange={(event) => {
                          const next = event.target.value.slice(0, STORY_MAX);
                          updateField("story", next);
                        }}
                        maxLength={STORY_MAX}
                        rows={6}
                        className="w-full flex-1 min-h-0 resize-none rounded-lg border border-transparent bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
                        placeholder="A short story or note about this recipe."
                      />
                      <div className="mt-1 text-right text-[11px] tabular-nums text-ink-muted">
                        {recipe.story.length}/{STORY_MAX}
                      </div>
                    </div>
                  </div>

                  {/* Right — seven fields stacked, uniform space-y-6 rhythm. */}
                  <div className="space-y-6 self-start">
                    <Field label="Recipe title">
                      <input
                        className={inputClass}
                        value={recipe.title}
                        onChange={(event) =>
                          updateField("title", event.target.value)
                        }
                      />
                    </Field>

                    <Field label="Tagline (short description)">
                      <div className="relative">
                        <input
                          className={inputClass + " pr-16"}
                          value={recipe.subtitle}
                          maxLength={TAGLINE_MAX}
                          onChange={(event) => {
                            const next = event.target.value.slice(
                              0,
                              TAGLINE_MAX,
                            );
                            updateField("subtitle", next);
                          }}
                        />
                        <span className="pointer-events-none absolute bottom-1.5 right-3 text-[11px] tabular-nums text-ink-muted">
                          {recipe.subtitle.length}/{TAGLINE_MAX}
                        </span>
                      </div>
                    </Field>

                    <Field label="Author">
                      <input
                        className={inputClass}
                        value={recipe.author}
                        onChange={(event) =>
                          updateField("author", event.target.value)
                        }
                        placeholder="e.g. K. Indira Devi"
                      />
                    </Field>

                    <Field label="Source">
                      <input
                        className={inputClass}
                        value={recipe.source}
                        onChange={(event) =>
                          updateField("source", event.target.value)
                        }
                      />
                    </Field>

                    <Field label="Tags" hint="Separate tags with commas.">
                      <input
                        className={inputClass}
                        value={tagsText}
                        onChange={(event) => {
                          setTagsText(event.target.value);
                          setDirty(true);
                        }}
                      />
                    </Field>

                    {/* Category — custom dropdown (Safari ignores
                        appearance:none on native <select> after hydration). */}
                    <Field label="Category">
                      <CategorySelect
                        value={recipe.category_slug}
                        categories={categories}
                        onChange={(slug) =>
                          updateField("category_slug", slug)
                        }
                      />
                    </Field>

                    <Field label="Serves">
                      <input
                        className={inputClass}
                        value={recipe.serves}
                        onChange={(event) =>
                          updateField("serves", event.target.value)
                        }
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                /* READ — Variant B: label + value below, no boxes; tags as
                   comma text; category resolved to its display name. The hero
                   image stays visible (no "Change image" overlay). Empty
                   fields (E1) keep their label with blank space beneath. */
                <>
                  <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-[1fr_2fr]">
                    <div className="flex flex-col gap-6">
                      <HeroImage
                        url={recipe.hero_image_url}
                        editable={false}
                      />
                    </div>

                    <div className="space-y-6 self-start">
                      <ReadField label="Recipe title" value={recipe.title} />
                      <ReadField
                        label="Tagline (short description)"
                        value={recipe.subtitle}
                      />
                      <ReadField label="Author" value={recipe.author} />
                      <ReadField label="Source" value={recipe.source} />
                      <ReadField label="Tags" value={recipe.tags.join(", ")} />
                      <ReadField
                        label="Category"
                        value={categoryName(recipe.category_slug, categories)}
                      />
                      <ReadField label="Serves" value={recipe.serves} />
                    </div>
                  </div>

                  {/* Story prose, below the meta block (Variant B). An empty
                      story leaves the label with blank space beneath (E1). */}
                  <div className="mt-8 max-w-2xl">
                    <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted">
                      Story
                    </span>
                    <div className="mt-2 min-h-[1.5rem] space-y-3 leading-relaxed text-ink">
                      {recipe.story
                        .split(/\n+/)
                        .map((para) => para.trim())
                        .filter(Boolean)
                        .map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Kitchen Notes tab — a single large free-text area bound to
              recipes.notes. The column has always been loaded and saved;
              this tab simply makes it editable. */}
          {activeTab === "notes" && (
            <>
              {/* Header strip — heading + subtitle on the left; the edit
                  trigger on the right, read state only. */}
              <div className="mt-8 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-medium text-ink">
                    Kitchen Notes
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Variations, substitutions, storage, reheating, festive
                    context — the practical wisdom for this dish.
                    <br />
                    Press <span className="font-semibold">Save recipe</span>{" "}
                    when you are done.
                  </p>
                </div>
                {!notesEditing && (
                  <EditTrigger
                    ariaLabel="Edit kitchen notes"
                    onClick={() => setNotesEditing(true)}
                  />
                )}
              </div>

              {notesEditing ? (
                /* EDIT — one large free-text area, autofocused (only one
                   field, so autofocus is unambiguous), with the counter. */
                <div className="mt-6 flex flex-col rounded-2xl border border-rule bg-card p-4">
                  <textarea
                    autoFocus
                    value={recipe.notes}
                    onChange={(event) => {
                      const next = event.target.value.slice(0, NOTES_MAX);
                      updateField("notes", next);
                    }}
                    maxLength={NOTES_MAX}
                    rows={16}
                    className="w-full resize-none rounded-lg border border-transparent bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
                    placeholder="e.g. Swap coconut oil for ghee for a richer finish. Keeps 3 days refrigerated; reheat gently with a splash of water. Traditionally served at Onam."
                  />
                  <div className="mt-1 text-right text-[11px] tabular-nums text-ink-muted">
                    {recipe.notes.length}/{NOTES_MAX}
                  </div>
                </div>
              ) : (
                /* READ — notes as prose, sitting on the cream page (no box).
                   Empty notes (E1) leave only blank space below the heading. */
                <div className="mt-6 min-h-[1.5rem] max-w-2xl space-y-3 leading-relaxed text-ink">
                  {recipe.notes
                    .split(/\n+/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              )}
            </>
          )}

          {/* Ingredients tab (2B) — section cards with ingredient rows. */}
          {activeTab === "ingredients" && (
            <IngredientsEditor
              sections={recipe.sections}
              ingredients={recipe.ingredients}
              onChange={updateIngredients}
              savedNonce={savedNonce}
            />
          )}

          {/* Steps tab (2D) — timeline of step cards. */}
          {activeTab === "steps" && (
            <StepsEditor
              steps={recipe.steps}
              onChange={updateSteps}
              savedNonce={savedNonce}
            />
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4">
          <div
            className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
              toast.kind === "ok" ? "bg-accent" : "bg-ink"
            }`}
          >
            {toast.kind === "ok" ? "✓ " : "⚠ "}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}

/** A labelled form field. The <label> wraps its control for accessibility. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted mb-1.5">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs text-ink-muted mt-1">{hint}</span>
      )}
    </label>
  );
}

/** Read-state field: small-caps label with the value on the line below.
 *  An empty value (E1) renders the label with blank space beneath — the
 *  min-height keeps that gap visible so the field still reads as "present
 *  but unset". No box. */
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <span className="mt-1 block min-h-[1.5rem] text-ink">{value}</span>
    </div>
  );
}

/** Resolve a category slug to its display name (read state). Returns "" if
 *  the slug has no match, so an unset category shows blank (E1) rather than
 *  the raw slug. */
function categoryName(slug: string, categories: Category[]): string {
  return categories.find((c) => c.slug === slug)?.name ?? "";
}

/**
 * The top-right edit trigger for the single-form tabs: a "Click to edit"
 * label beside a pencil chiclet. The whole thing is one button so the label
 * is clickable too. The chiclet matches the top bar's close button (h-9 w-9,
 * rounded-chiclet, rule border, accent on hover) — no circles (design
 * signature).
 */
function EditTrigger({
  ariaLabel,
  onClick,
}: {
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="group inline-flex shrink-0 items-center gap-2 text-sm text-ink-muted"
    >
      <span>Click to edit</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-chiclet border border-rule text-ink-soft transition-colors group-hover:border-accent group-hover:text-accent">
        <Pencil className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}

/**
 * The hero image card — fixed 4:3 regardless of the source photo's natural
 * ratio (the <img> is absolutely positioned so its intrinsic size can't push
 * past the frame). Shown in both read and edit state; the "Change image"
 * overlay appears only when editable (upload itself lands in Stage 4).
 */
function HeroImage({
  url,
  editable,
}: {
  url: string | null;
  editable: boolean;
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-rule bg-card">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted/70">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
            aria-hidden
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span className="text-xs">No image yet</span>
        </div>
      )}
      {editable && (
        <button
          type="button"
          disabled
          title="Image upload coming in Stage 4"
          className="absolute bottom-4 left-4 inline-flex cursor-not-allowed items-center gap-2 rounded-chiclet bg-stone-800/85 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm"
        >
          <Camera className="h-3.5 w-3.5" aria-hidden />
          Change image
        </button>
      )}
    </div>
  );
}

/**
 * A custom category dropdown. We use a button + popover instead of a
 * native <select> because Safari's UA stylesheet for <select> ignores
 * `appearance: none !important` after hydration in some builds, leaving
 * a visibly mismatched native-chrome control. A custom widget renders
 * identically across browsers.
 *
 * Behaviour:
 *  - Click or Enter/Space toggles the popover.
 *  - ArrowUp / ArrowDown moves the highlight, Enter selects.
 *  - Esc closes (and returns focus to the button).
 *  - Clicking outside closes.
 *  - aria-haspopup / aria-expanded / role="listbox"+"option" for a11y.
 */
function CategorySelect({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (slug: string) => void;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const selected = categories.find((c) => c.slug === value);

  // Sync the highlighted row to the current value whenever the popover
  // opens, so keyboard nav starts on the selected item.
  useEffect(() => {
    if (!open) return;
    const idx = categories.findIndex((c) => c.slug === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, value, categories]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: globalThis.MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(slug: string) {
    onChange(slug);
    setOpen(false);
    // Return focus to the trigger so the user can keep tabbing forward.
    buttonRef.current?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
      setHighlight((h) => Math.min(h + 1, categories.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlight(categories.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const picked = categories[highlight];
      if (picked) pick(picked.slug);
    }
  }

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // Same inputClass as every other input — guarantees identical
        // background, border, radius, padding, font. pr-10 reserves room
        // for the chevron overlay; text-left because <button> default-centres.
        className={inputClass + " cursor-pointer pr-10 text-left"}
      >
        {selected ? selected.name : <span className="text-ink-muted">Choose a category…</span>}
      </button>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
      />
      {open && (
        <ul
          role="listbox"
          aria-label="Category"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-rule bg-card py-1 shadow-lg"
        >
          {categories.map((category, index) => {
            const isSelected = category.slug === value;
            const isHighlighted = index === highlight;
            return (
              <li
                key={category.slug}
                role="option"
                aria-selected={isSelected}
                // onMouseDown (not onClick) so the outside-click handler
                // doesn't fire first and close the popover before the
                // click registers.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(category.slug);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={
                  "cursor-pointer px-3 py-2 text-sm text-ink " +
                  (isHighlighted ? "bg-background" : "")
                }
              >
                {category.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Left-nav icon for a section. lucide-react icons, sized to ~18px. */
function TabIcon({ id }: { id: TabId }) {
  const Icon = {
    overview: LayoutGrid,
    ingredients: Soup,
    steps: ListChecks,
    notes: FileText,
  }[id];

  return <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />;
}
