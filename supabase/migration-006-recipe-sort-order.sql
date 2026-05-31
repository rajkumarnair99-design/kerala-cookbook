-- ============================================================
-- Migration 006 — recipes.sort_order (within-category position)
-- ============================================================
-- Adds a per-recipe ordering column, scoped to each category, for the
-- admin recipe-ordering feature. Backfills alphabetically by title within
-- each category as a dense 0..n-1 sequence.
--
-- SAFE TO RE-RUN: the backfill only fills rows whose sort_order is still
-- NULL (i.e. only on the very first run, right after the column is added),
-- so re-running this file will NEVER reset an order the owner has since set
-- through the admin UI.
--
-- NOTE: the atomic reorder helper function (reorder_recipes) is NOT here.
-- It ships in a later migration alongside the admin server actions, so this
-- migration is purely the column + backfill + index (per the approved
-- Step-1 scope).
-- ============================================================

-- 1. Add the column (nullable while we backfill).
alter table public.recipes
  add column if not exists sort_order integer;

-- 2. Backfill: alphabetical by title WITHIN each category, as a dense
--    0..n-1 sequence. The `r.sort_order is null` guard means a re-run is a
--    no-op once values exist — it will not clobber a hand-set order.
with ranked as (
  select id,
         row_number() over (
           partition by category_slug
           order by title asc
         ) - 1 as rn
  from public.recipes
)
update public.recipes r
   set sort_order = ranked.rn
  from ranked
 where ranked.id = r.id
   and r.sort_order is null;

-- 3. Lock it down: a default for future inserts, and NOT NULL now that
--    every existing row has a value.
alter table public.recipes alter column sort_order set default 0;
alter table public.recipes alter column sort_order set not null;

-- 4. Ordering index for (category_slug, sort_order) lookups.
create index if not exists idx_recipes_category_sort
  on public.recipes (category_slug, sort_order);
