-- ============================================================
-- Kerala Family Cookbook — Migration 008:
-- reorder_recipes(groups jsonb) — atomic recipe reordering for the
-- admin recipe list.
--
-- Run ONCE in the Supabase SQL Editor, AFTER migration 006 added
-- recipes.sort_order. Safe to re-run (create or replace). It creates one
-- function and changes no tables or data on its own.
--
-- What this function does, in English:
--   The admin list lets the owner drag recipes to reorder them within a
--   category, or drag one into a different category. On drop, the client
--   sends the COMPLETE new ordering of each AFFECTED category as a list of
--   "groups". This function rewrites each affected category's positions as
--   a dense 0..n-1 block, setting both category_slug and sort_order. The
--   whole thing runs in one transaction, so a bad slug or category rolls
--   the entire reorder back — the list can never end up half-moved.
--
-- Payload shape (the `groups` argument):
--   [
--     { "category_slug": "meat-dishes",  "recipe_slugs": ["a","b","c"] },
--     { "category_slug": "fish-dishes",  "recipe_slugs": ["x","y"] }
--   ]
--   - One element per affected category.
--   - Within-category reorder  → 1 element  (that category's full new order).
--   - Cross-category move       → 2 elements (source category WITHOUT the
--                                 moved recipe, re-densified; destination
--                                 category WITH the moved recipe inserted at
--                                 its new position).
--   - A recipe's category change happens naturally: it simply appears in the
--     destination group, so its category_slug is rewritten. No separate
--     "move" path is needed.
--
-- CONTRACT (important): each group must list EVERY recipe that should be in
--   that category after the operation. The function writes exactly what it
--   is told; it does NOT verify completeness. A partial group would leave
--   omitted recipes with stale sort_orders (possible duplicate positions).
--   The calling server action is responsible for sending full orderings.
--
-- Photo safety: touches public.recipes (category_slug, sort_order) ONLY.
--   Never references recipe_steps or step_photos — so the Steps photo-safety
--   canary stays a valid regression check after this migration.
--
-- Security: SECURITY DEFINER + `set search_path = public` (Supabase's
--   standard hardening), execute granted only to service_role.
-- ============================================================

create or replace function public.reorder_recipes(groups jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group   jsonb;
  v_cat     text;
  v_slug    text;
  v_pos     integer;
  v_seen    text[] := '{}';   -- every slug seen so far, for duplicate detection
  v_updated integer;
begin
  for v_group in
    select * from jsonb_array_elements(coalesce(groups, '[]'::jsonb))
  loop
    v_cat := v_group->>'category_slug';

    -- Validate the category before touching any of its rows.
    if v_cat is null then
      raise exception 'reorder_recipes: a group is missing "category_slug"';
    end if;
    if not exists (select 1 from public.categories where slug = v_cat) then
      raise exception 'reorder_recipes: unknown category_slug "%"', v_cat;
    end if;

    -- Rewrite this category's positions as a dense 0..n-1 block.
    v_pos := 0;
    for v_slug in
      select jsonb_array_elements_text(coalesce(v_group->'recipe_slugs', '[]'::jsonb))
    loop
      -- A slug may appear at most once across the WHOLE payload; two
      -- occurrences would assign one recipe two positions.
      if v_slug = any (v_seen) then
        raise exception
          'reorder_recipes: recipe slug "%" appears more than once in the payload', v_slug;
      end if;
      v_seen := v_seen || v_slug;

      update public.recipes
         set category_slug = v_cat,
             sort_order    = v_pos
       where slug = v_slug;

      get diagnostics v_updated = row_count;
      if v_updated = 0 then
        raise exception 'reorder_recipes: unknown recipe slug "%"', v_slug;
      end if;

      v_pos := v_pos + 1;
    end loop;
  end loop;
end;
$$;

-- Lock the function down: only the trusted secret key (service_role) may
-- run it (the admin server actions call it via supabaseAdmin).
revoke all on function public.reorder_recipes(jsonb) from public, anon, authenticated;
grant execute on function public.reorder_recipes(jsonb) to service_role;
