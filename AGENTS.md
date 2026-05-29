<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design signature — chiclets, no circles

The owner's deliberate visual signature (a nod to the uniCare logo's rounded-square chiclets): **no pure circles anywhere we control.** Every container, button, badge, chip, avatar, status dot, or shape we render is a square/rectangle with rounded corners — a "chiclet." **All future components must follow this**, including the Steps tab and the public-site redesign.

**Never use `rounded-full`** on a shape we control. Use the graduated scale, picking the radius by the element's size:

| Element size | Radius | Tailwind |
|---|---|---|
| tiny (≤16px — e.g. status dots) | 2px | `rounded-sm` |
| small chips (<32px tall) | 8px | `rounded-lg` |
| default controls (32–52px) + any converted pill | 12px | `rounded-chiclet` |
| large shapes (≥56px) | 16px | `rounded-2xl` |
| cards | 16px | `rounded-2xl` |

`rounded-chiclet` is the house token (`--radius-chiclet: 0.75rem` in `app/globals.css`). **Mental model: corner radius ≈ a quarter of the element's height, never half** (half makes a circle or a stadium/pill — both forbidden).

**Exceptions (leave round):** pictographic icon *artwork* (a lucide clock face, camera lens, etc.) and purely decorative micro-dots (≤~4px ornaments, SVG texture patterns). Square the *containers*, never the glyph or the texture.

# Palette signature — warm cream, no white

A companion to the chiclet signature. **Nothing we control is stark white (`#ffffff`).** Every surface in the editor is a warm off-cream. Surfaces are separated by **borders, not by big fill jumps** — the tonal step between page, card, and input is almost imperceptible (within ~2–4% lightness); the `--rule` border does the visual separating.

| Token | Hex | Use |
|---|---|---|
| `--page` (currently `--background`) | `#faf6f0` | editor body / outermost background |
| `--card` | `#fdfaf4` | section cards, step cards, all container surfaces |
| `--inset` | `#fdfaf4` | **form inputs, textareas, dropdown panels — never white** |
| `--soft` | `#f7f1ec` | tip-style tinted callouts |
| `--rule` | `#e6ddd1` | borders & dividers (kept visible on purpose) |
| `--accent` / `--accent-soft` / `--accent-ink` | `#a85a3a` / `#c47a5c` / `#7a3f28` | terracotta accent |

Rules:
- **Form inputs use `--inset` (Tailwind `bg-inset`), never `bg-white` / `bg-surface` / `#fff`.**
- Container surfaces use `bg-card`; tinted callouts use `bg-soft`.
- **The mockup is the source of truth for these values.** Re-sample with `scripts/sample-mockup-palette.ts` to detect and correct drift.

**Recorded deviation:** the mockup's literal surfaces sample at ~`#fbf9f8` (a cooler, paler near-white) and are near-identical page/card/inset. We keep `--page`/`--card`/`--inset` ~3–8 units **warmer** than that to preserve the established warm-cream identity; **`--soft` is taken literally** as the mockup's `#f7f1ec`. `--rule` is kept at its current, more-visible value (the mockup's border is nearly invisible, which would stop cards reading as cards).

**Scope note:** these tokens are applied across the **editor** (Overview, Ingredients, Steps, Kitchen Notes, all dialogs/dropdowns). The shared `--surface` token (still `#ffffff`) and the public site are a separate pass.
