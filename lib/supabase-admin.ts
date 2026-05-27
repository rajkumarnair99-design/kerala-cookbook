import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. " +
      "Check your .env.local file (and the Vercel environment variables).",
  );
}

/**
 * Supabase client built with the SECRET key — it bypasses Row Level
 * Security, so it is allowed to write recipe data.
 *
 * SERVER ONLY. Never import this into a Client Component. The secret key
 * has no NEXT_PUBLIC_ prefix, so it is never bundled for the browser — an
 * accidental client import would throw the error above rather than leak
 * the key. Used only by the editor's Save action.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
