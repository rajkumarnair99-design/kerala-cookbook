/**
 * Capture the reworked Ingredients tab (view-first / edit-on-click) in its
 * various states. Reuses the magic-link → session-cookie shortcut.
 *
 *   npx tsx scripts/screenshot-ingredients.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import puppeteer, { type Page } from "puppeteer-core";
import { createChunks, stringToBase64URL } from "@supabase/ssr/dist/main/utils";

const SLUG = process.argv[2] ?? "nadan-chicken-curry";
const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "/tmp";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gotoIngredients(page: Page) {
  await page.goto(`${BASE}/admin/recipes/${SLUG}/edit`, {
    waitUntil: "networkidle0",
    timeout: 30_000,
  });
  await wait(2_000);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("nav button")).find(
      (b) => b.textContent?.trim() === "Ingredients",
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });
  await wait(600);
}

/** The i-th <section> in <main>, scrolled into view. */
async function sectionHandle(page: Page, i: number) {
  const h = await page.evaluateHandle((idx) => {
    const s = document.querySelectorAll("main section")[idx] ?? null;
    (s as HTMLElement | null)?.scrollIntoView({ block: "center" });
    return s;
  }, i);
  await wait(250);
  return h.asElement();
}

/** Click the pencil (Edit section) on the i-th section. */
async function clickPencil(page: Page, i: number) {
  await page.evaluate((idx) => {
    const s = document.querySelectorAll("main section")[idx];
    const btn = s?.querySelector(
      'button[aria-label="Edit section"]',
    ) as HTMLButtonElement | null;
    btn?.click();
  }, i);
  await wait(400);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const email = process.env.ADMIN_EMAIL!;
  if (!supabaseUrl || !secret || !email) {
    throw new Error("Missing env (URL / SECRET / ADMIN_EMAIL)");
  }
  const projectRef = new URL(supabaseUrl).host.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  const admin = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const actionLink = data.properties?.action_link;
  if (!actionLink) throw new Error("No action_link");
  const verifyResp = await fetch(actionLink, { redirect: "manual" });
  const location = verifyResp.headers.get("location");
  if (!location) throw new Error(`No redirect (${verifyResp.status})`);
  const params = new URLSearchParams(location.slice(location.indexOf("#") + 1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_in = Number(params.get("expires_in") ?? 3600);
  const expires_at = Number(
    params.get("expires_at") ?? Math.floor(Date.now() / 1000) + expires_in,
  );
  if (!access_token || !refresh_token) throw new Error("No tokens");
  const { data: userResp, error: userErr } =
    await admin.auth.getUser(access_token);
  if (userErr || !userResp.user) throw userErr ?? new Error("No user");
  const session = {
    access_token,
    refresh_token,
    token_type: "bearer",
    expires_in,
    expires_at,
    user: userResp.user,
  };
  const encoded = "base64-" + stringToBase64URL(JSON.stringify(session));
  const chunks = createChunks(cookieName, encoded);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) =>
      console.log("[pageerror]", (err as Error).message),
    );
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 2 });
    for (const chunk of chunks) {
      await page.setCookie({
        name: chunk.name,
        value: chunk.value,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      });
    }

    // (a) Full READ state — quiet, no edit affordances.
    await gotoIngredients(page);
    await page.screenshot({ path: `${OUT}/ing-a-read-full.png`, fullPage: true });
    console.log("✓ a: full read state");

    // (d)+(f) Header — helper text top-right + two-line subtitle.
    {
      const header = await page.evaluateHandle(() => {
        const h2 = Array.from(document.querySelectorAll("main h2")).find(
          (e) => e.textContent?.trim() === "Ingredients",
        );
        return h2?.parentElement?.parentElement ?? null;
      });
      const el = header.asElement();
      if (!el) throw new Error("no header");
      await el.screenshot({ path: `${OUT}/ing-df-header.png` });
      console.log("✓ d+f: header helper text + subtitle");
    }

    // (c) "+" inserters between sections, faint (no hover).
    await gotoIngredients(page);
    {
      const s0 = await sectionHandle(page, 0);
      const s1 = await sectionHandle(page, 1);
      const b0 = await s0!.boundingBox();
      const b1 = await s1!.boundingBox();
      if (!b0 || !b1) throw new Error("need two sections");
      await page.screenshot({
        path: `${OUT}/ing-c-inserters.png`,
        clip: {
          x: Math.max(0, b0.x - 6),
          y: b0.y + b0.height - 26,
          width: b0.width + 12,
          height: b1.y - (b0.y + b0.height) + 52,
        },
      });
      console.log("✓ c: + inserters between sections");
    }

    // (b) One section in EDIT state (pencil clicked).
    await gotoIngredients(page);
    await clickPencil(page, 0);
    {
      const el = await sectionHandle(page, 0);
      await el!.screenshot({ path: `${OUT}/ing-b-edit-section.png` });
      console.log("✓ b: section in edit state");
    }

    // (e) New section being typed (live-write). Insert at top, type a title.
    await gotoIngredients(page);
    await page.evaluate(() => {
      const b = document.querySelector(
        'button[aria-label="Add a section here"]',
      ) as HTMLButtonElement | null;
      b?.click();
    });
    await wait(450);
    await page.focus('input[aria-label="Section name"]');
    await page.keyboard.type("For the tempering");
    await wait(250);
    {
      const el = await sectionHandle(page, 0);
      await el!.screenshot({ path: `${OUT}/ing-e-typing-title.png` });
      console.log("✓ e: live-write section title");
    }

    console.log("\nAll shots in /tmp/ing-*.png");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
