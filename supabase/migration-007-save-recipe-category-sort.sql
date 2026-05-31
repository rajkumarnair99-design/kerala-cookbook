-- ============================================================
-- Kerala Family Cookbook — Migration 007:
-- save_recipe — move a recipe to the bottom of its category when the
-- category changes.
--
-- Run ONCE in the Supabase SQL Editor, AFTER migration 006 has added
-- recipes.sort_order. Safe to re-run (create or replace). It changes one
-- function and no tables or data.
--
-- What this migration does, in English:
--   When a save changes a recipe's category_slug, the recipe is placed at
--   the BOTTOM of its new category (max(sort_order) + 1 within that
--   category; 0 if the new category is empty). When the category is
--   unchanged, sort_order is left exactly as it was — so an ordinary
--   content edit never reshuffles positions. (Reordering within/across
--   categories on the admin list is handled separately, not by this
--   function.)
--
-- SCOPE OF THE CHANGE vs migration-005:
--   * declare block: two new variables (v_old_category, v_new_sort_order).
--   * section 1: capture the current category before the update; if the
--     category changed, compute the new bottom-of-category sort_order; and
--     the recipes UPDATE gains ONE new assignment:
--         sort_order = coalesce(v_new_sort_order, sort_order)
--   * EVERYTHING ELSE IS BYTE-FOR-BYTE IDENTICAL to migration-005 —
--     sections 2-7 (validation, ingredient delete, section delete/upsert,
--     ingredient upsert, and steps 7a/7b/7c) are unchanged.
--   * step_photos is NOT referenced (it never was) — so the Steps
--     photo-safety canary remains a valid regression gate.
--
-- Security posture is unchanged: plain plpgsql (NOT security definer),
-- execute granted only to service_role.
--
-- This supersedes the function body in migration-005 /
-- supabase/save-recipe-function.sql for the sort_order behaviour; keep
-- those in sync if save_recipe is edited again.
-- ============================================================

create or replace function public.save_recipe(payload jsonb)
returns void
language plpgsql
as $$
declare
  v_recipe_id       bigint;
  v_sec             jsonb;
  v_ing             jsonb;
  v_step            jsonb;
  v_kept_sec_ids    bigint[];
  v_kept_ing_ids    bigint[];
  v_kept_step_ids   bigint[];
  v_section_map     jsonb := '{}'::jsonb;   -- client_key → new section id
  v_new_section_id  bigint;
  v_resolved_sec_id bigint;
  v_section_name    text;
  v_old_category    text;                   -- NEW (007): category before this save
  v_new_sort_order  integer := null;        -- NEW (007): bottom-of-category, only on change
begin
  -- ------------------------------------------------------------
  -- 1. Top-level recipe fields. Capture the recipe id.
  -- ------------------------------------------------------------

  -- NEW (007): read the current category BEFORE the update so we can tell
  -- whether the category is changing. If it is, compute the new category's
  -- bottom slot (max sort_order + 1; -1+1 = 0 when the new category is
  -- empty). If the category is unchanged, v_new_sort_order stays NULL and
  -- the coalesce below leaves sort_order alone (idempotent).
  select category_slug into v_old_category
    from public.recipes
   where slug = payload->>'slug';

  if (payload->>'category_slug') is distinct from v_old_category then
    select coalesce(max(sort_order), -1) + 1
      into v_new_sort_order
      from public.recipes
     where category_slug = payload->>'category_slug';
  end if;

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
    hero_image_url = payload->>'hero_image_url',
    sort_order     = coalesce(v_new_sort_order, sort_order)  -- NEW (007)
  where slug = payload->>'slug'
  returning id into v_recipe_id;

  if v_recipe_id is null then
    raise exception 'save_recipe: no recipe found with slug %', payload->>'slug';
  end if;

  -- ------------------------------------------------------------
  -- 2. Pre-flight validation: every ingredient's section reference
  --    must be resolvable from the sections in this payload. We
  --    check this BEFORE any DELETE so failures roll back cleanly
  --    with a clear error and no data churn.
  --
  --    An ingredient is valid if either:
  --      (a) section_id is set and that id appears in payload.sections, OR
  --      (b) section_client_key is set and a payload.section has the
  --          same client_key (and id is null — a newly added section).
  -- ------------------------------------------------------------
  perform 1
  from jsonb_array_elements(coalesce(payload->'ingredients', '[]'::jsonb)) as ing
  where not exists (
    select 1
      from jsonb_array_elements(coalesce(payload->'sections', '[]'::jsonb)) as sec
     where (ing->>'section_id' is not null
            and sec->>'id' is not null
            and (ing->>'section_id')::bigint = (sec->>'id')::bigint)
        or (ing->>'section_client_key' is not null
            and sec->>'client_key' is not null
            and ing->>'section_client_key' = sec->>'client_key')
  );
  if found then
    raise exception
      'save_recipe: one or more ingredients reference a section that is not in the save payload. The editor must include every section that any ingredient belongs to.';
  end if;

  -- ------------------------------------------------------------
  -- 3. Ingredients: delete the ones the editor dropped FIRST, so
  --    any section that is also being dropped is no longer
  --    referenced when we get to step 4.
  -- ------------------------------------------------------------
  select coalesce(array_agg((i->>'id')::bigint), '{}')
    into v_kept_ing_ids
  from jsonb_array_elements(coalesce(payload->'ingredients', '[]'::jsonb)) as i
  where i->>'id' is not null;

  delete from public.recipe_ingredients
   where recipe_id = v_recipe_id
     and id <> all (v_kept_ing_ids);

  -- ------------------------------------------------------------
  -- 4. Sections: delete the ones the editor dropped. ON DELETE
  --    RESTRICT will raise if any surviving ingredient still
  --    references one of these — which would mean the editor
  --    has a bug; we want to know about it loudly.
  -- ------------------------------------------------------------
  select coalesce(array_agg((s->>'id')::bigint), '{}')
    into v_kept_sec_ids
  from jsonb_array_elements(coalesce(payload->'sections', '[]'::jsonb)) as s
  where s->>'id' is not null;

  delete from public.recipe_sections
   where recipe_id = v_recipe_id
     and id <> all (v_kept_sec_ids);

  -- ------------------------------------------------------------
  -- 5. Sections: upsert. Update existing rows by id; insert new
  --    rows and remember their new ids in v_section_map keyed by
  --    the editor's client_key string.
  -- ------------------------------------------------------------
  for v_sec in
    select *
      from jsonb_array_elements(coalesce(payload->'sections', '[]'::jsonb))
  loop
    if v_sec->>'id' is not null then
      update public.recipe_sections set
        name       = coalesce(v_sec->>'name', ''),
        sort_order = (v_sec->>'sort_order')::integer,
        collapsed  = coalesce((v_sec->>'collapsed')::boolean, false)
      where id = (v_sec->>'id')::bigint
        and recipe_id = v_recipe_id;
    else
      insert into public.recipe_sections (recipe_id, name, sort_order, collapsed)
      values (
        v_recipe_id,
        coalesce(v_sec->>'name', ''),
        (v_sec->>'sort_order')::integer,
        coalesce((v_sec->>'collapsed')::boolean, false)
      )
      returning id into v_new_section_id;

      if v_sec->>'client_key' is not null then
        v_section_map := v_section_map ||
          jsonb_build_object(v_sec->>'client_key', v_new_section_id);
      end if;
    end if;
  end loop;

  -- ------------------------------------------------------------
  -- 6. Ingredients: upsert. For each row, resolve section_id —
  --    either it's already an id from step 5, or look it up by
  --    client_key in v_section_map. Also write the (legacy)
  --    section TEXT column with the resolved section's name, so
  --    the backup column stays in sync until Session 3 drops it.
  -- ------------------------------------------------------------
  for v_ing in
    select *
      from jsonb_array_elements(coalesce(payload->'ingredients', '[]'::jsonb))
  loop
    -- Resolve section_id.
    if v_ing->>'section_id' is not null then
      v_resolved_sec_id := (v_ing->>'section_id')::bigint;
    elsif v_ing->>'section_client_key' is not null then
      v_resolved_sec_id := (v_section_map->>(v_ing->>'section_client_key'))::bigint;
      if v_resolved_sec_id is null then
        raise exception
          'save_recipe: ingredient "%" references section_client_key "%" which was not created in this save',
          coalesce(v_ing->>'name', '<unnamed>'),
          v_ing->>'section_client_key';
      end if;
    else
      raise exception
        'save_recipe: ingredient "%" has neither section_id nor section_client_key',
        coalesce(v_ing->>'name', '<unnamed>');
    end if;

    -- Look up the resolved section's name for the legacy TEXT backup.
    select name into v_section_name
      from public.recipe_sections
     where id = v_resolved_sec_id
       and recipe_id = v_recipe_id;

    if v_ing->>'id' is not null then
      update public.recipe_ingredients set
        section_id  = v_resolved_sec_id,
        section     = v_section_name,
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
        (recipe_id, section_id, section, name, quantity, unit,
         preparation, optional, sort_order)
      values (
        v_recipe_id,
        v_resolved_sec_id,
        v_section_name,
        coalesce(v_ing->>'name', ''),
        nullif(v_ing->>'quantity', ''),
        nullif(v_ing->>'unit', ''),
        nullif(v_ing->>'preparation', ''),
        coalesce((v_ing->>'optional')::boolean, false),
        (v_ing->>'sort_order')::integer
      );
    end if;
  end loop;

  -- ------------------------------------------------------------
  -- 7. Steps — unchanged from the previous version. Updated in
  --    place by id so step photos survive.
  -- ------------------------------------------------------------

  -- 7a. Remove steps the editor deleted.
  select coalesce(array_agg((s->>'id')::bigint), '{}')
    into v_kept_step_ids
  from jsonb_array_elements(coalesce(payload->'steps', '[]'::jsonb)) as s
  where s->>'id' is not null;

  delete from public.recipe_steps
   where recipe_id = v_recipe_id
     and id <> all (v_kept_step_ids);

  -- 7b. Park surviving step_numbers as negatives, so the renumbering
  --     below cannot trip the unique(recipe_id, step_number) constraint.
  update public.recipe_steps
     set step_number = -step_number
   where recipe_id = v_recipe_id;

  -- 7c. Write each step at its final position: update existing by id,
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
-- run it.
revoke all on function public.save_recipe(jsonb) from public, anon, authenticated;
grant execute on function public.save_recipe(jsonb) to service_role;
