import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Check your .env.local file (and the Vercel environment variables).",
  );
}

/**
 * Supabase client for Client Components (runs in the browser).
 * Used by the admin login form to request a magic-link email.
 * Auth tokens are stored in cookies so the server can read the session.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl!, supabaseKey!);
}
