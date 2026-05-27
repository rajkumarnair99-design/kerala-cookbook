-- ============================================================
-- Kerala Family Cookbook — Migration 002: preserve ingredient ids
--
-- Bug this fixes:
--   The previous save_recipe replaced every recipe_ingredients row
--   on every save — wholesale DELETE then INSERT. The Stage 2A Step 3
--   canary check caught it: an Overview-tab save (which doesn't even
--   show ingredients) reissued all 22 of Nadan Chicken Curry's
--   ingredient ids on every save. Today nothing FKs to those ids, so
--   it's invisible; tomorrow (shopping lists, meal plans, per-
--   ingredient notes) it would silently break those references.
--
-- What this migration changes:
--   - save_recipe now updates ingredients in place by id, matching
--     the existing behaviour for steps.
--   - Ingredients with id=null in the payload are treated as new and
--     inserted; ingredients whose id is not in the payload are deleted.
--   - No table changes. No data migration. Existing ingredient ids
--     are preserved by the new function on the next save.
--
-- Companion code changes (required for end-to-end correctness):
--   - types/recipe.ts          → EditorIngredient.id: number | null
--   - lib/recipes.ts           → SELECT + map ingredient id
--   - app/admin/recipes/[slug]/edit/actions.ts → send id in payload
--   - components/admin/IngredientsEditor.tsx   → blankIngredient uses id: null
--
-- Run ONCE in the Supabase SQL Editor. Safe to re-run (create or
-- replace). The function body below is identical to
-- supabase/save-recipe-function.sql; keep the two in sync if you
-- ever edit save_recipe again.
-- ============================================================

create or replace function public.save_recipe(payload jsonb)
returns void
language plpgsql
as $$
declare
  v_recipe_id      bigint;
  v_ing            jsonb;
  v_step           jsonb;
  v_kept_ing_ids   bigint[];
  v_kept_step_ids  bigint[];
begin
  -- 1. Top-level recipe fields. Capture the recipe id.
  update public.recipes set
    title          = payload->>'title',
    subtitle       = payload->>'subtitle',
    category_slug  = payload->>'category_slug',
    serves         = payload->>'serves',
    tags           = coalesce(
                       (select array_agg(t)
                          from jsonb_array_elements_text(
                                 coalesce(payload->'tags', '[]'::jsonb)) as t),
                       '{}'),
    source         = payload->>'source',
    notes          = payload->>'notes',
    story          = payload->>'story',
    author         = payload->>'author',
    hero_image_url = payload->>'hero_image_url'
  where slug = payload->>'slug'
  returning id into v_recipe_id;

  if v_recipe_id is null then
    raise exception 'save_recipe: no recipe found with slug %', payload->>'slug';
  end if;

  -- 2. Ingredients — updated in place by id so that any future reference
  --    to an ingredient id (shopping lists, meal plans, etc.) survives.
  --    Rows with id=null are new and get inserted; rows whose id is not
  --    in the editor's payload are deletions.

  -- 2a. Remove ingredients the editor dropped.
  select coalesce(array_agg((i->>'id')::bigint), '{}')
    into v_kept_ing_ids
  from jsonb_array_elements(coalesce(payload->'ingredients', '[]'::jsonb)) as i
  where i->>'id' is not null;

  delete from public.recipe_ingredients
   where recipe_id = v_recipe_id
     and id <> all (v_kept_ing_ids);

  -- 2b. Write each ingredient at its final position: update existing by
  --     id (recipe_ingredients has no unique constraint on sort_order, so
  --     no parking trick is needed), insert the newly added ones.
  for v_ing in
    select *
      from jsonb_array_elements(coalesce(payload->'ingredients', '[]'::jsonb))
  loop
    if v_ing->>'id' is not null then
      update public.recipe_ingredients set
        section     = nullif(v_ing->>'section', ''),
        name        = coalesce(v_ing->>'name', ''),
        quantity    = nullif(v_ing->>'quantity', ''),
        unit        = nullif(v_ing->>'unit', ''),
        preparation = nullif(v_ing->>'preparation', ''),
        optional    = coalesce((v_ing->>'optional')::boolean, false),
        sort_order  = (v_ing->>'sort_order')::integer
      where id = (v_ing->>'id')::bigint
        and recipe_id = v_recipe_id;
    else
      insert into public.recipe_ingredients
        (recipe_id, section, name, quantity, unit, preparation, optional, sort_order)
      values (
        v_recipe_id,
        nullif(v_ing->>'section', ''),
        coalesce(v_ing->>'name', ''),
        nullif(v_ing->>'quantity', ''),
        nullif(v_ing->>'unit', ''),
        nullif(v_ing->>'preparation', ''),
        coalesce((v_ing->>'optional')::boolean, false),
        (v_ing->>'sort_order')::integer
      );
    end if;
  end loop;

  -- 3. Steps — updated in place by id so step photos survive.

  -- 3a. Remove steps the editor deleted.
  select coalesce(array_agg((s->>'id')::bigint), '{}')
    into v_kept_step_ids
  from jsonb_array_elements(coalesce(payload->'steps', '[]'::jsonb)) as s
  where s->>'id' is not null;

  delete from public.recipe_steps
   where recipe_id = v_recipe_id
     and id <> all (v_kept_step_ids);

  -- 3b. Park surviving step_numbers as negatives, so the renumbering
  --     below cannot trip the unique(recipe_id, step_number) constraint.
  update public.recipe_steps
     set step_number = -step_number
   where recipe_id = v_recipe_id;

  -- 3c. Write each step at its final position: update existing by id,
  --     insert the newly added ones.
  for v_step in
    select *
      from jsonb_array_elements(coalesce(payload->'steps', '[]'::jsonb))
  loop
    if v_step->>'id' is not null then
      update public.recipe_steps set
        step_number   = (v_step->>'step_number')::integer,
        instruction   = coalesce(v_step->>'instruction', ''),
        timer_minutes = nullif(v_step->>'timer_minutes', '')::integer,
        tip           = nullif(v_step->>'tip', '')
      where id = (v_step->>'id')::bigint
        and recipe_id = v_recipe_id;
    else
      insert into public.recipe_steps
        (recipe_id, step_number, instruction, timer_minutes, tip)
      values (
        v_recipe_id,
        (v_step->>'step_number')::integer,
        coalesce(v_step->>'instruction', ''),
        nullif(v_step->>'timer_minutes', '')::integer,
        nullif(v_step->>'tip', '')
      );
    end if;
  end loop;
end;
$$;

-- Lock the function down: only the trusted secret key (service_role) may
-- run it. Supabase grants new functions to anon/authenticated by default,
-- so those must be revoked explicitly — revoking from public is not enough.
revoke all on function public.save_recipe(jsonb) from public, anon, authenticated;
grant execute on function public.save_recipe(jsonb) to service_role;
