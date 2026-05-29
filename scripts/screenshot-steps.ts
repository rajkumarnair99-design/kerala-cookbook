/**
 * One-off: capture the reworked Steps tab in its various states for review.
 * Reuses the magic-link → session-cookie shortcut from screenshot-editor.ts,
 * then drives the new click-to-edit interactions and snapshots each state.
 *
 *   npx tsx scripts/screenshot-steps.ts
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

async function gotoSteps(page: Page) {
  await page.goto(`${BASE}/admin/recipes/${SLUG}/edit`, {
    waitUntil: "networkidle0",
    timeout: 30_000,
  });
  await wait(2_000);
  // Switch to the Steps section.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("nav button")).find(
      (b) => b.textContent?.trim() === "Steps",
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });
  await wait(500);
  // Let any step photos finish loading.
  await page
    .evaluate(() =>
      Promise.all(
        Array.from(document.querySelectorAll("main img")).map((img) => {
          const el = img as HTMLImageElement;
          if (el.complete) return null;
          return new Promise((res) => {
            el.onload = res;
            el.onerror = res;
          });
        }),
      ),
    )
    .catch(() => {});
  await wait(400);
}

/** The Nth step ROW (rail + card) — the sortable node = grip's grandparent. */
async function rowHandle(page: Page, index: number) {
  const handle = await page.evaluateHandle((i) => {
    const grips = Array.from(
      document.querySelectorAll('button[aria-label="Drag to reorder step"]'),
    );
    const row = grips[i]?.parentElement?.parentElement ?? null;
    row?.scrollIntoView({ block: "center" });
    return row;
  }, index);
  await wait(250);
  return handle.asElement();
}

/** The Nth step CARD (the bordered box; the row's last child). Scrolls it into
 *  view so boundingBox()/clicks land on-screen. */
async function cardHandle(page: Page, index: number) {
  const handle = await page.evaluateHandle((i) => {
    const grips = Array.from(
      document.querySelectorAll('button[aria-label="Drag to reorder step"]'),
    );
    const card = grips[i]?.parentElement?.parentElement?.lastElementChild ?? null;
    (card as HTMLElement | null)?.scrollIntoView({ block: "center" });
    return card;
  }, index);
  await wait(250);
  return handle.asElement();
}

/** Click the body of card N (activates it without hitting a control). */
async function activateCard(page: Page, index: number) {
  const el = await cardHandle(page, index);
  if (!el) throw new Error(`No card ${index}`);
  const box = await el.boundingBox();
  if (!box) throw new Error(`Card ${index} has no box`);
  // Click in the instruction area (right of the photo), away from any control.
  await page.mouse.click(box.x + 220, box.y + 24);
  await wait(300);
}

/** Click a button in <main> by its exact trimmed text. */
async function clickButtonByText(page: Page, text: string) {
  await page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll("main button")).find(
      (b) => b.textContent?.trim() === t,
    ) as HTMLButtonElement | undefined;
    btn?.click();
  }, text);
  await wait(300);
}

/** Click somewhere outside any step (the "Steps" heading area). */
async function clickOutside(page: Page) {
  const h = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll("main h2")).find(
      (e) => e.textContent?.trim() === "Steps",
    ),
  );
  const el = h.asElement();
  const box = el ? await el.boundingBox() : null;
  if (box) await page.mouse.click(box.x + 4, box.y + 4);
  else await page.mouse.click(400, 120);
  await wait(350);
}

/** Number of step rows currently rendered. */
async function rowCount(page: Page) {
  return page.evaluate(
    () =>
      document.querySelectorAll('button[aria-label="Drag to reorder step"]')
        .length,
  );
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const email = process.env.ADMIN_EMAIL!;
  if (!supabaseUrl || !secret || !email) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / ADMIN_EMAIL",
    );
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
  if (!actionLink) throw new Error("No action_link from Supabase");

  const verifyResp = await fetch(actionLink, { redirect: "manual" });
  const location = verifyResp.headers.get("location");
  if (!location) throw new Error(`Expected a redirect, got ${verifyResp.status}`);
  const params = new URLSearchParams(location.slice(location.indexOf("#") + 1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_in = Number(params.get("expires_in") ?? 3600);
  const expires_at = Number(
    params.get("expires_at") ?? Math.floor(Date.now() / 1000) + expires_in,
  );
  if (!access_token || !refresh_token) {
    throw new Error("Verify redirect missing tokens");
  }
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
    page.on("pageerror", (err) => console.log("[pageerror]", (err as Error).message));
    // The editor's unsaved-changes guard pops a beforeunload dialog that would
    // otherwise block our re-navigations after a shot dirties the form.
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
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

    // Indices from the recipe data:
    //  idx 4 (step 5): no timer, no tip
    //  idx 3 (step 4): 1-min timer, no tip  → proves "Add timer" relabels to
    //                                          "Edit timer" without disappearing
    const NO_TIMER = 4;
    const WITH_TIMER = 3;

    // (a) Edit state, NO timer →
    //     buttons: Add timer / Edit step / Add tip / Add image.
    await gotoSteps(page);
    await activateCard(page, NO_TIMER);
    {
      const el = await rowHandle(page, NO_TIMER);
      await el!.screenshot({ path: `${OUT}/btn4-a-no-timer.png` });
      console.log("✓ a: edit state, no timer");
    }

    // (b) Edit state, WITH timer →
    //     buttons: Edit timer / Edit step / Add tip / Add image.
    await gotoSteps(page);
    await activateCard(page, WITH_TIMER);
    {
      const el = await rowHandle(page, WITH_TIMER);
      await el!.screenshot({ path: `${OUT}/btn4-b-with-timer.png` });
      console.log("✓ b: edit state, with timer (Add timer → Edit timer)");
    }

    // (c) Steps page top — the new two-line subtitle.
    await gotoSteps(page);
    {
      const header = await page.evaluateHandle(() => {
        const h2 = Array.from(document.querySelectorAll("main h2")).find(
          (e) => e.textContent?.trim() === "Steps",
        );
        return h2?.parentElement?.parentElement ?? null;
      });
      const el = header.asElement();
      if (!el) throw new Error("could not find Steps header");
      await el.screenshot({ path: `${OUT}/btn4-c-subtitle.png` });
      console.log("✓ c: two-line subtitle");
    }

    console.log("\nAll shots in /tmp/btn4-*.png");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
