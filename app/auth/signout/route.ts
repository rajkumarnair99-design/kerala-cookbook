import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Signs the owner out and returns them to the login page.
 * Triggered by the "Sign out" form in the admin header.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.url), {
    status: 303,
  });
}
