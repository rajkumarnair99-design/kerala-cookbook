-- ============================================================
-- Kerala Family Cookbook — Stage 1 database schema
-- Run this ONCE in the Supabase SQL Editor.
-- Safe to read; it only creates empty tables. No data is added here.
-- ============================================================

-- 1. CATEGORIES — the 7 recipe groups and their display names
create table public.categories (
  slug        text primary key,
  name        text not null,
  sort_order  integer not null
);

-- 2. COOKBOOK_META — a single row describing the source book
create table public.cookbook_meta (
  id             integer primary key default 1 check (id = 1),
  book_title     text not null,
  recipes_by     text,
  translated_by  text,
  year           integer,
  note           text
);

-- 3. RECIPES — one row per recipe
create table public.recipes (
  id             bigint generated always as identity primary key,
  slug           text not null unique,
  title          text not null,
  subtitle       text,
  category_slug  text not null references public.categories(slug),
  serves         text,
  tags           text[] not null default '{}',
  source         text,
  notes          text,
  story          text,
  author         text,
  is_public      boolean not null default true,
  video_url      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 4. RECIPE_INGREDIENTS — ingredients belonging to a recipe
create table public.recipe_ingredients (
  id           bigint generated always as identity primary key,
  recipe_id    bigint not null references public.recipes(id) on delete cascade,
  section      text,
  name         text not null,
  quantity     text,
  unit         text,
  preparation  text,
  optional     boolean not null default false,
  sort_order   integer not null
);

-- 5. RECIPE_STEPS — the cooking steps of a recipe
create table public.recipe_steps (
  id             bigint generated always as identity primary key,
  recipe_id      bigint not null references public.recipes(id) on delete cascade,
  step_number    integer not null,
  instruction    text not null,
  timer_minutes  integer,
  tip            text,
  unique (recipe_id, step_number)
);

-- 6. STEP_PHOTOS — photos attached to a single step
create table public.step_photos (
  id          bigint generated always as identity primary key,
  step_id     bigint not null references public.recipe_steps(id) on delete cascade,
  url         text not null,
  sort_order  integer not null
);

-- ------------------------------------------------------------
-- Indexes — keep lookups fast
-- ------------------------------------------------------------
create index idx_recipes_category_slug     on public.recipes (category_slug);
create index idx_recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);
create index idx_recipe_steps_recipe       on public.recipe_steps (recipe_id);
create index idx_step_photos_step          on public.step_photos (step_id);

-- ------------------------------------------------------------
-- Trigger — keep recipes.updated_at fresh automatically.
-- Whenever a recipe row is modified, updated_at is set to now(),
-- so the future admin editor never has to set it by hand.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_recipes_updated_at
  before update on public.recipes
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Security (Row Level Security)
-- Anyone may READ recipe data. No one may change it through the
-- public key — writes happen only via the trusted secret key.
-- ------------------------------------------------------------
alter table public.categories         enable row level security;
alter table public.cookbook_meta      enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps       enable row level security;
alter table public.step_photos        enable row level security;

create policy "Public read" on public.categories         for select using (true);
create policy "Public read" on public.cookbook_meta      for select using (true);
create policy "Public read" on public.recipes            for select using (true);
create policy "Public read" on public.recipe_ingredients for select using (true);
create policy "Public read" on public.recipe_steps       for select using (true);
create policy "Public read" on public.step_photos        for select using (true);
