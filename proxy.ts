import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Check your .env.local file (and the Vercel environment variables).",
  );
}

/**
 * Runs before every /admin request. (Next.js 16 renamed "middleware" to "proxy".)
 *
 * Two jobs:
 *   1. Keep the Supabase auth session fresh by reading and rewriting its cookies.
 *   2. Optimistically send logged-out visitors to the login page.
 *
 * This is only a first-pass check. The authoritative "is this the owner?"
 * check lives inside the /admin pages themselves, as the Next.js docs advise.
 */
export async function proxy(request: NextRequest) {
  // The response we will return. The Supabase client replaces it below
  // if it needs to write refreshed auth cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the session when the access token has expired.
  // Nothing should run between creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every request that reaches here is under /admin (see matcher below).
  // Send logged-out visitors to the login page — but never loop on it.
  if (!user && request.nextUrl.pathname !== "/admin/login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
