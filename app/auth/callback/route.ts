import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Magic-link landing point. Supabase sends the owner here after they click
 * the email link, with a one-time `code` in the URL. We exchange that code
 * for a logged-in session (stored in cookies) and forward them to /admin.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // On Vercel the public host arrives in x-forwarded-host; prefer it
      // so the redirect doesn't point at an internal hostname.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      const base =
        !isLocal && forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${base}/admin`);
    }

    console.error("Auth callback could not exchange code:", error.message);
  }

  // No code, or the exchange failed — send them back to sign in again.
  return NextResponse.redirect(`${origin}/admin/login`);
}
