import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const adminEmail = process.env.ADMIN_EMAIL;

if (!adminEmail) {
  throw new Error(
    "Missing ADMIN_EMAIL environment variable. Add it to .env.local " +
      "(and the Vercel environment variables).",
  );
}

/**
 * The authoritative admin gate. Call this at the top of any /admin server
 * component or route handler. If the visitor is not signed in as the
 * cookbook owner, it redirects them to the login page and never returns.
 *
 * Returns the signed-in owner's Supabase user when access is allowed.
 */
export async function requireOwner(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== adminEmail!.toLowerCase()) {
    redirect("/admin/login");
  }

  return user;
}
