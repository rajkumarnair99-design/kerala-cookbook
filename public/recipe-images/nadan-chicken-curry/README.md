# Nadan Chicken Curry — Step Photos

36 step-by-step photos extracted from your cooking PDF, renamed in order, optimized for web.

## Where these photos belong in your project

Place this entire `nadan-chicken-curry/` folder inside your project at:

    kerala-cookbook/public/recipe-images/nadan-chicken-curry/

The `public/` folder is where Next.js serves static files. Once placed there, each image is accessible via a URL like:

    /recipe-images/nadan-chicken-curry/step-01a-chilies-before-roasting.jpg

## Naming convention

Each file is named `step-XX[letter]-short-description.jpg`:

- `step-01a` and `step-01b` are paired photos for step 1 (before/after roasting chilies)
- `step-08a`, `step-08b`, `step-08c` belong to step 8 (onion browning progression)
- Single-letter absent = single-photo step (e.g. `step-12-covered-simmering.jpg`)

## What's next

Replace the `nadan-chicken-curry` entry in `seed-recipes.json` with the updated recipe (Claude Code will handle this), then the cook mode on that recipe will display these real photos instead of placeholders.
