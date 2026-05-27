-- ============================================================
-- Kerala Family Cookbook — Migration 001: hero_image_url
--
-- Adds a recipe-level hero image URL column and updates save_recipe
-- to write it through. Run ONCE in the Supabase SQL Editor.
--
-- Safe to re-run: the ALTER uses IF NOT EXISTS, the function uses
-- CREATE OR REPLACE.
--
-- After this migration, hero_image_url is NULL for every existing
-- recipe. Stage 4 (photo uploads) will populate it.
--
-- The function body below is identical to supabase/save-recipe-function.sql;
-- keep the two in sync if you ever edit save_recipe again.
-- ============================================================

-- 1. Add the hero image column (recipe-level, not per-step).
alter table public.recipes
  add column if not exists hero_image_url text;

-- 2. Replace save_recipe so it writes hero_image_url through.
create or replace function public.save_recipe(payload jsonb)
returns void
language plpgsql
as $$
declare
  v_recipe_id bigint;
  v_ing       jsonb;
  v_step      jsonb;
  v_kept_ids  bigint[];
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

  -- 2. Ingredients — replaced wholesale (safe: no photos, one transaction).
  delete from public.recipe_ingredients where recipe_id = v_recipe_id;

  for v_ing in
    select *
      from jsonb_array_elements(coalesce(payload->'ingredients', '[]'::jsonb))
  loop
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
  end loop;

  -- 3. Steps — updated in place by id so step photos survive.

  -- 3a. Remove steps the editor deleted.
  select coalesce(array_agg((s->>'id')::bigint), '{}')
    into v_kept_ids
  from jsonb_array_elements(coalesce(payload->'steps', '[]'::jsonb)) as s
  where s->>'id' is not null;

  delete from public.recipe_steps
   where recipe_id = v_recipe_id
     and id <> all (v_kept_ids);

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

-- 3. Re-apply privileges — only the trusted secret key may run save_recipe.
revoke all on function public.save_recipe(jsonb) from public, anon, authenticated;
grant execute on function public.save_recipe(jsonb) to service_role;
