-- ============================================================
-- Kerala Family Cookbook — Migration 004:
-- Promote sections to first-class entities.
--
-- Run ONCE in the Supabase SQL Editor, AFTER migration 003 has
-- already normalised section names. Wrapped in a transaction.
--
-- IMPORTANT: this migration must be paired with migration 005
-- (which teaches save_recipe how to read the new section_id
-- column). Apply 003 → 004 → 005 in the same SQL Editor session.
-- Saves will FAIL between 004 and 005 because section_id is
-- NOT NULL but the old save_recipe doesn't know to populate it.
--
-- What this migration does, in English:
--   1. Creates a new table recipe_sections — one row per (recipe,
--      section), with a stable id, name, sort_order, and a
--      "collapsed in the editor" flag.
--   2. Adds a section_id column to recipe_ingredients that points
--      at recipe_sections. ON DELETE RESTRICT means Postgres
--      refuses to drop a section that still has ingredients
--      pointing at it (UI must reassign first).
--   3. Backfill: for every recipe, creates one "Main ingredients"
--      section to hold ingredients that currently have no section,
--      plus one section row per distinct named section. Points
--      every existing ingredient at the right section.
--   4. Locks recipe_ingredients.section_id to NOT NULL — from now
--      on every ingredient must belong to a section row.
--   5. Leaves recipe_ingredients.section (the old TEXT column) in
--      place as a safety-net backup. We drop it in Stage 2B
--      Session 3 after the new UI is verified end-to-end.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. New table.
-- ------------------------------------------------------------
create table public.recipe_sections (
  id          bigint generated always as identity primary key,
  recipe_id   bigint  not null references public.recipes(id) on delete cascade,
  name        text    not null,
  sort_order  integer not null,
  collapsed   boolean not null default false
);
create index idx_recipe_sections_recipe on public.recipe_sections (recipe_id);

-- RLS: same pattern as every other table — public can read, writes
-- only via the secret key (no policy = no write for anon/authenticated).
alter table public.recipe_sections enable row level security;
create policy "Public read" on public.recipe_sections for select using (true);

-- ------------------------------------------------------------
-- 2. New column on recipe_ingredients. Nullable for now so the
-- backfill below can populate it before we lock it.
-- ------------------------------------------------------------
alter table public.recipe_ingredients
  add column section_id bigint references public.recipe_sections(id)
    on delete restrict;

create index idx_recipe_ingredients_section
  on public.recipe_ingredients (section_id);

-- ------------------------------------------------------------
-- 3a. Create one "Main ingredients" section per recipe that has
-- any unsectioned ingredients (section IS NULL or = ''). Always
-- sort_order = 0 so it sits at the top.
-- ------------------------------------------------------------
insert into public.recipe_sections (recipe_id, name, sort_order, collapsed)
select distinct recipe_id, 'Main ingredients', 0, false
  from public.recipe_ingredients
 where section is null or section = '';

-- ------------------------------------------------------------
-- 3b. Create one section row per distinct (recipe, named section)
-- pair. sort_order = 1 + position of the section among that
-- recipe's named sections, ordered by where its first ingredient
-- appeared (so the order of sections in the editor matches the
-- order they appeared in the original ingredient list).
-- ------------------------------------------------------------
insert into public.recipe_sections (recipe_id, name, sort_order, collapsed)
select recipe_id,
       section,
       row_number() over (
         partition by recipe_id
         order by min_sort
       ),
       false
  from (
    select recipe_id, section, min(sort_order) as min_sort
      from public.recipe_ingredients
     where section is not null
       and section <> ''
     group by recipe_id, section
  ) named;

-- ------------------------------------------------------------
-- 3c. Point unsectioned ingredients at their recipe's Main section.
-- ------------------------------------------------------------
update public.recipe_ingredients i
   set section_id = s.id
  from public.recipe_sections s
 where i.recipe_id = s.recipe_id
   and s.name = 'Main ingredients'
   and (i.section is null or i.section = '');

-- ------------------------------------------------------------
-- 3d. Point named ingredients at the matching named section.
-- ------------------------------------------------------------
update public.recipe_ingredients i
   set section_id = s.id
  from public.recipe_sections s
 where i.recipe_id = s.recipe_id
   and i.section = s.name
   and i.section is not null
   and i.section <> '';

-- ------------------------------------------------------------
-- 4. Sanity check inside the transaction: every ingredient must
-- now have a section_id. If any row is still NULL, raise and roll
-- back so we never leave the database half-migrated.
-- ------------------------------------------------------------
do $$
declare
  v_orphans bigint;
begin
  select count(*)
    into v_orphans
    from public.recipe_ingredients
   where section_id is null;
  if v_orphans > 0 then
    raise exception
      'Migration 004 backfill failed: % ingredient row(s) still have NULL section_id. Rolling back.',
      v_orphans;
  end if;
end $$;

-- 5. Lock the column down. From here on, every new ingredient
-- must have a section_id.
alter table public.recipe_ingredients
  alter column section_id set not null;

-- ------------------------------------------------------------
-- 6. Note for the operator (you): recipe_ingredients.section
-- (the old TEXT column) is INTENTIONALLY still here. It is now
-- a backup. The new save_recipe (migration 005) will keep it in
-- sync going forward. Stage 2B Session 3 will drop it.
-- ------------------------------------------------------------

commit;

-- ------------------------------------------------------------
-- 7. Post-commit verification queries (paste into the SQL Editor
-- after COMMIT to confirm the migration landed cleanly):
-- ------------------------------------------------------------
-- -- Section row count per recipe (should be >= 1 for every recipe
-- -- that has any ingredients):
-- select r.title,
--        (select count(*) from public.recipe_sections s where s.recipe_id = r.id) as sections,
--        (select count(*) from public.recipe_ingredients i where i.recipe_id = r.id) as ingredients
--   from public.recipes r
--  order by sections, r.title;
--
-- -- Every ingredient now has a section_id:
-- select count(*) as orphan_ingredients
--   from public.recipe_ingredients
--  where section_id is null;
--
-- -- Distinct section names in the new table:
-- select name, count(*) as recipes_using_it
--   from public.recipe_sections
--  group by name
--  order by recipes_using_it desc;
