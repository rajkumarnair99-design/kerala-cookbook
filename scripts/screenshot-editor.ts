/**
 * Screenshots the admin Overview tab as the cookbook owner.
 *
 * The login flow is magic-link only; we shortcut it by minting a session
 * via Supabase admin and composing the `@supabase/ssr` session cookie
 * directly, then driving Chrome via puppeteer-core.
 *
 *   npx tsx scripts/screenshot-editor.ts [slug] [output-png]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";
// These utils have no DOM dependencies — safe to require in Node.
import { createChunks, stringToBase64URL } from "@supabase/ssr/dist/main/utils";

const SLUG = process.argv[2] ?? "nadan-chicken-curry";
const OUT = (process.argv[3] ?? "/tmp/editor-overview.png") as `${string}.png`;
const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const email = process.env.ADMIN_EMAIL!;
  if (!supabaseUrl || !secret || !email) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / ADMIN_EMAIL");
  }
  const projectRef = new URL(supabaseUrl).host.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  // 1. Mint a magic-link. Supabase returns an action_link that, when
  //    followed, redirects to the site URL with the access/refresh tokens
  //    in the URL fragment.
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

  // 2. Follow the action_link with fetch (manual redirect handling) to
  //    grab the location header — it carries the tokens in the fragment.
  const verifyResp = await fetch(actionLink, { redirect: "manual" });
  const location = verifyResp.headers.get("location");
  if (!location) throw new Error(`Expected a redirect from verify, got status ${verifyResp.status}`);
  const fragmentStart = location.indexOf("#");
  if (fragmentStart === -1) throw new Error(`No fragment on redirect URL: ${location}`);
  const params = new URLSearchParams(location.slice(fragmentStart + 1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_in = Number(params.get("expires_in") ?? 3600);
  const expires_at = Number(params.get("expires_at") ?? Math.floor(Date.now() / 1000) + expires_in);
  if (!access_token || !refresh_token) {
    throw new Error("Verify redirect missing access_token / refresh_token");
  }

  // 3. Fetch the user record so the session cookie carries everything
  //    `getUser()` on the server would expect.
  const { data: userResp, error: userErr } = await admin.auth.getUser(access_token);
  if (userErr || !userResp.user) throw userErr ?? new Error("Could not fetch user");
  const session = {
    access_token,
    refresh_token,
    token_type: "bearer",
    expires_in,
    expires_at,
    user: userResp.user,
  };

  // 4. Encode the session the same way @supabase/ssr's browser client does:
  //    JSON → base64url → "base64-" prefix → chunked.
  const encoded = "base64-" + stringToBase64URL(JSON.stringify(session));
  const chunks = createChunks(cookieName, encoded);
  console.log(`session encoded in ${chunks.length} chunk(s)`);

  // 5. Launch Chrome, set the cookies on localhost, navigate to the editor.
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`[browser ${msg.type()}]`, msg.text());
      }
    });
    page.on("pageerror", (err) => console.log("[browser pageerror]", err.message));

    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

    for (const chunk of chunks) {
      await page.setCookie({
        name: chunk.name,
        value: chunk.value,
        domain: "localhost",
        path: "/",
        httpOnly: false, // browser-client cookies are readable by JS
        secure: false,
        sameSite: "Lax",
      });
    }

    const editorUrl = `${BASE}/admin/recipes/${SLUG}/edit`;
    const resp = await page.goto(editorUrl, { waitUntil: "networkidle0", timeout: 30_000 });
    const finalUrl = page.url();
    if (!finalUrl.includes(`/admin/recipes/${SLUG}/edit`)) {
      throw new Error(
        `Expected editor, ended at ${finalUrl} (status ${resp?.status() ?? "?"})`,
      );
    }

    // Give the client component time to fully hydrate and any client-side
    // styling (re)mounts to settle before snapshotting.
    await new Promise((r) => setTimeout(r, 2_500));

    // Optionally switch to a specific left-nav tab before snapshotting:
    //   --tab="Kitchen Notes"
    const tabArg = process.argv.find((a) => a.startsWith("--tab="));
    if (tabArg) {
      const label = tabArg.slice("--tab=".length);
      const clicked = await page.evaluate((wanted) => {
        const btn = Array.from(document.querySelectorAll("nav button")).find(
          (b) => b.textContent?.trim() === wanted,
        ) as HTMLButtonElement | undefined;
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, label);
      if (!clicked) throw new Error(`Could not find nav tab labelled "${label}"`);
      await new Promise((r) => setTimeout(r, 400));
    }

    await page.screenshot({ path: OUT, fullPage: true });

    // Also capture the dropdown in its open state, if --open is passed.
    if (process.argv.includes("--open")) {
      await page.click('button[aria-haspopup="listbox"]');
      await new Promise((r) => setTimeout(r, 400));
      const openPath = OUT.replace(/\.png$/, "-open.png") as `${string}.png`;
      await page.screenshot({ path: openPath, fullPage: true });
      console.log(`Saved open-state screenshot → ${openPath}`);
    }
    console.log(`Saved screenshot → ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
