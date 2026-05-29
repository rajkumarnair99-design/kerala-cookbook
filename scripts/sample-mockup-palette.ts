/**
 * Phase 0 palette extraction. Reads the design mockup and reports the LITERAL
 * pixel colors at specific regions, so the editor palette can be unified
 * against the mockup rather than eyeballed.
 *
 *   npx tsx scripts/sample-mockup-palette.ts
 *
 * Uses `sharp` (already a dependency via Next.js image optimization) to decode
 * the PNG to raw RGBA, then samples small clean patches.
 *
 *  - Uniform surfaces (page/card/inset/tip/accent): MEDIAN of the patch, with
 *    per-channel spread (max-min) so we can tell a clean patch from a
 *    contaminated one (low spread = trustworthy).
 *  - Type foreground: the DARKEST pixel in a text patch (the ink tone).
 *  - Rule/divider: scans a strip and reports the darkest pixel + where it sits,
 *    to locate the thin line.
 */
import sharp from "sharp";

const PATH = "/Users/rajkumarnair/Desktop/steps-mockup.png";

function hex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

async function main() {
  const { data, info } = await sharp(PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  console.log(`Image: ${width}×${height}, ${channels} channels\n`);

  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Median + spread over a w×h patch anchored at (x,y).
  function patch(name: string, x: number, y: number, w = 8, h = 8) {
    const rs: number[] = [],
      gs: number[] = [],
      bs: number[] = [];
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const [r, g, b] = px(xx, yy);
        rs.push(r);
        gs.push(g);
        bs.push(b);
      }
    const mid = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
    const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
    const r = mid(rs),
      g = mid(gs),
      b = mid(bs);
    const sp = Math.max(spread(rs), spread(gs), spread(bs));
    console.log(
      `${name.padEnd(34)} ${hex(r, g, b)}  rgb(${r},${g},${b})  spread=${sp}${sp > 6 ? "  ⚠ noisy — re-pick" : ""}`,
    );
  }

  // Darkest pixel in a patch (for the ink/foreground tone).
  function darkest(name: string, x: number, y: number, w: number, h: number) {
    let best: [number, number, number] = [255, 255, 255];
    let bestLum = 999;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const [r, g, b] = px(xx, yy);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < bestLum) {
          bestLum = lum;
          best = [r, g, b];
        }
      }
    console.log(`${name.padEnd(34)} ${hex(...best)}  rgb(${best.join(",")})`);
  }

  // Scan a horizontal strip; report the darkest column (locates a vertical line).
  function scanV(name: string, x0: number, x1: number, y: number) {
    let bx = x0,
      bestLum = 999,
      bestc: [number, number, number] = [255, 255, 255];
    for (let xx = x0; xx <= x1; xx++) {
      // average a few rows to stabilise
      let r = 0,
        g = 0,
        b = 0;
      for (let yy = y; yy < y + 6; yy++) {
        const [rr, gg, bb] = px(xx, yy);
        r += rr;
        g += gg;
        b += bb;
      }
      r = Math.round(r / 6);
      g = Math.round(g / 6);
      b = Math.round(b / 6);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < bestLum) {
        bestLum = lum;
        bx = xx;
        bestc = [r, g, b];
      }
    }
    console.log(
      `${name.padEnd(34)} ${hex(...bestc)}  rgb(${bestc.join(",")})  @x=${bx}`,
    );
  }

  console.log("— UNIFORM SURFACES (median, low spread = clean) —");
  patch("PAGE  (right of buttons, y210)", 1360, 205);
  patch("PAGE  (left gutter)", 250, 430);
  patch("PAGE  (right gutter, beside c2)", 1372, 560);
  patch("CARD  (card1 top whitespace)", 936, 262, 10, 8);
  patch("CARD  (card1 lower-right)", 1322, 405);
  patch("CARD  (card2 upper-right)", 1320, 470);
  patch("INSET? (Add-image button fill)", 1175, 292);
  patch("TIP   (body bg)", 782, 508, 10, 8);
  patch("ACCENT (Add step button)", 1140, 150);
  console.log("\n— INK / LINES —");
  scanV("RULE  (card1 right border)", 1352, 1376, 330);
  scanV("RULE  (zone divider near buttons)", 1000, 1075, 320);

  // Auto-locate the darkest pixel in card 1's content (= instruction ink).
  function findDarkest(x0: number, y0: number, x1: number, y1: number) {
    let best: [number, number, number] = [255, 255, 255],
      bl = 999,
      bx = 0,
      by = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const [r, g, b] = px(x, y);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < bl) {
          bl = lum;
          best = [r, g, b];
          bx = x;
          by = y;
        }
      }
    console.log(
      `TYPE  (darkest in card1 text)      ${hex(...best)}  rgb(${best.join(",")})  @(${bx},${by})`,
    );
  }
  findDarkest(660, 250, 1340, 440);

  // Auto-locate the most-orange pixel in the top bar (= accent button fill).
  function findAccent(x0: number, y0: number, x1: number, y1: number, label: string) {
    let best: [number, number, number] = [0, 0, 0],
      bo = -999,
      bx = 0,
      by = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const [r, g, b] = px(x, y);
        const orange = r - b + (r - g); // high for terracotta/orange
        if (orange > bo) {
          bo = orange;
          best = [r, g, b];
          bx = x;
          by = y;
        }
      }
    console.log(
      `${label.padEnd(34)} ${hex(...best)}  rgb(${best.join(",")})  @(${bx},${by})`,
    );
  }
  findAccent(950, 100, 1402, 200, "ACCENT (top-bar buttons)");
  findAccent(0, 0, 1402, 100, "ACCENT (very top bar)");
  findAccent(640, 250, 760, 540, "ACCENT (Tip leaf/label area)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
