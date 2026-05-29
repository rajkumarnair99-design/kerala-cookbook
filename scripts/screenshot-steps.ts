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

/** Element handle for the Nth step card (its root div = the grip's parent). */
async function cardHandle(page: Page, index: number) {
  const handle = await page.evaluateHandle((i) => {
    const grips = Array.from(
      document.querySelectorAll('button[aria-label="Drag to reorder step"]'),
    );
    const card = grips[i]?.parentElement ?? null;
    card?.scrollIntoView({ block: "center" });
    return card;
  }, index);
  await wait(250);
  return handle.asElement();
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

/** Click the body of card N (activates it without hitting a control). */
async function activateCard(page: Page, index: number) {
  const el = await cardHandle(page, index);
  if (!el) throw new Error(`No card ${index}`);
  const box = await el.boundingBox();
  if (!box) throw new Error(`Card ${index} has no box`);
  // Click near the top-left of the instruction column, away from buttons/grip.
  await page.mouse.click(box.x + 90, box.y + 24);
  await wait(300);
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

    // Card indices (0-based) chosen from the recipe's data:
    //  step 5 (idx 4): no tip, no timer    step 8 (idx 7): tip + 2-min timer
    //  step 1 (idx 0): has a tip
    const PLAIN = 4;
    const TIP_TIMER = 7;
    const TIPPED = 0;

    // (a) READ state, no tip & no timer — should still read as a clear card.
    await gotoSteps(page);
    {
      const el = await cardHandle(page, PLAIN);
      await el!.screenshot({ path: `${OUT}/steps2-a-read-plain.png` });
      console.log("✓ a: read state (no tip / no timer)");
    }

    // (b) READ state WITH tip and WITH timer.
    await gotoSteps(page);
    {
      const el = await cardHandle(page, TIP_TIMER);
      await el!.screenshot({ path: `${OUT}/steps2-b-read-tip-timer.png` });
      console.log("✓ b: read state (tip + timer)");
    }

    // (c) EDIT state — all four buttons; background must stay cream.
    await gotoSteps(page);
    await activateCard(page, TIPPED);
    {
      const el = await cardHandle(page, TIPPED);
      await el!.screenshot({ path: `${OUT}/steps2-c-edit-buttons.png` });
      console.log("✓ c: edit state, four buttons");
    }

    // (d) EDIT state with the instruction editor open.
    await gotoSteps(page);
    await activateCard(page, TIPPED);
    await clickButtonByText(page, "Edit step");
    await wait(300);
    {
      const el = await cardHandle(page, TIPPED);
      await el!.screenshot({ path: `${OUT}/steps2-d-edit-instruction.png` });
      console.log("✓ d: edit state, instruction editor open");
    }

    // (e) The tip callout, close up (read state).
    await gotoSteps(page);
    {
      const tip = await page.evaluateHandle((i) => {
        const grips = Array.from(
          document.querySelectorAll('button[aria-label="Drag to reorder step"]'),
        );
        const card = grips[i]?.parentElement;
        if (!card) return null;
        const label = Array.from(card.querySelectorAll("span")).find(
          (s) => s.textContent?.trim() === "Tip",
        );
        const box = label?.parentElement?.parentElement ?? null;
        box?.scrollIntoView({ block: "center" });
        return box;
      }, TIPPED);
      await wait(250);
      const el = tip.asElement();
      if (!el) throw new Error("could not find tip callout");
      await el.screenshot({ path: `${OUT}/steps2-e-tip-closeup.png` });
      console.log("✓ e: tip callout close-up");
    }

    console.log("\nAll shots in /tmp/steps2-*.png");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
