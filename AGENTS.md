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
