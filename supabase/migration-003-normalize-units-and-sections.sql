-- ============================================================
-- Kerala Family Cookbook — Migration 003:
-- Normalize recipe_ingredients.unit and recipe_ingredients.section
-- values so they map cleanly to the canonical lists used by the new
-- Ingredients editor (Stage 2B).
--
-- Run ONCE in the Supabase SQL Editor. Wrapped in a transaction so
-- either everything applies or nothing does.
--
-- No tables are added, no rows are inserted or deleted. Only the
-- text values in two columns are rewritten.
--
-- ------------------------------------------------------------
-- UNIT mappings (decisions taken from the inventory):
--   cups        → cup
--   cloves      → clove
--   pinches     → pinch
--   sprigs      → sprig
--   bunches     → bunch
--   pieces      → piece
--   liter       → l
--   inch piece  → unit becomes 'piece', quantity gets '-inch' appended
--                 (so "1" + "inch piece" → "1-inch" + "piece")
--   can         → quantity becomes '<qty> can' (or '1 can' if qty empty),
--                 unit cleared to ''
--   cube        → quantity becomes '<qty> cube' (or '1 cube' if qty empty),
--                 unit cleared to ''
--   everything else: unchanged.
--
-- SECTION mappings:
--   'For seasoning'   → 'For the seasoning'   (83 rows; cosmetic)
--   'Roasted masala'  → 'For the roasted masala' (8 rows; cosmetic,
--                       matches "For the X" convention)
--   'Rasam'           → unchanged (intentional cross-reference)
--   'Koottu Curry'    → unchanged (intentional cross-reference)
--   everything else: unchanged.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. UNIT — simple plural/abbrev renames
-- ------------------------------------------------------------
update public.recipe_ingredients set unit = 'cup'   where unit = 'cups';
update public.recipe_ingredients set unit = 'clove' where unit = 'cloves';
update public.recipe_ingredients set unit = 'pinch' where unit = 'pinches';
update public.recipe_ingredients set unit = 'sprig' where unit = 'sprigs';
update public.recipe_ingredients set unit = 'bunch' where unit = 'bunches';
update public.recipe_ingredients set unit = 'piece' where unit = 'pieces';
update public.recipe_ingredients set unit = 'l'     where unit = 'liter';

-- ------------------------------------------------------------
-- 2. UNIT — 'inch piece' → 'piece' with quantity rewrite
-- "1" + "inch piece" becomes "1-inch" + "piece".
-- If quantity is blank/NULL (shouldn't happen per the inventory,
-- but defensively), default to "1".
-- ------------------------------------------------------------
update public.recipe_ingredients
   set quantity = coalesce(nullif(quantity, ''), '1') || '-inch',
       unit     = 'piece'
 where unit = 'inch piece';

-- ------------------------------------------------------------
-- 3. UNIT — 'can' (1 row) → quantity carries the "can", unit cleared
-- ------------------------------------------------------------
update public.recipe_ingredients
   set quantity = coalesce(nullif(quantity, ''), '1') || ' can',
       unit     = ''
 where unit = 'can';

-- ------------------------------------------------------------
-- 4. UNIT — 'cube' (1 row) → same pattern as 'can'
-- ------------------------------------------------------------
update public.recipe_ingredients
   set quantity = coalesce(nullif(quantity, ''), '1') || ' cube',
       unit     = ''
 where unit = 'cube';

-- ------------------------------------------------------------
-- 5. SECTION — cosmetic renames so every section name follows the
-- "For the X" convention. Rasam / Koottu Curry are intentionally
-- left alone (they cross-reference standalone recipes).
-- ------------------------------------------------------------
update public.recipe_ingredients
   set section = 'For the seasoning'
 where section = 'For seasoning';

update public.recipe_ingredients
   set section = 'For the roasted masala'
 where section = 'Roasted masala';

-- ------------------------------------------------------------
-- 6. Verification — after this migration the canonical-unit check
-- below should return zero rows. Run it after COMMIT to confirm.
-- ------------------------------------------------------------
-- select distinct unit
--   from public.recipe_ingredients
--  where unit is not null
--    and unit not in (
--          '',
--          -- Weight
--          'g','kg','oz','lb',
--          -- Volume
--          'ml','l','tsp','tbsp','cup',
--          -- Count
--          'nos','small','medium','large',
--          -- Bunches / portions
--          'pinch','sprig','bunch','handful','slice','piece','clove','stick','leaf',
--          -- Special
--          'to taste','as needed'
--        );

commit;
