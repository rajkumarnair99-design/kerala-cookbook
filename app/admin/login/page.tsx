"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Status = "idle" | "sending" | "sent" | "error";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Only an account that already exists may sign in — no new users.
        shouldCreateUser: false,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-serif text-lg text-ink">Good food at home</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mt-1">
            A Kerala Family Recipe Collection
          </p>
        </div>

        <div className="bg-surface border border-rule rounded-2xl p-8 shadow-sm">
          {status === "sent" ? (
            <div className="text-center">
              <h1 className="font-serif text-2xl text-ink">Check your email</h1>
              <p className="text-sm text-ink-soft mt-3 leading-relaxed">
                We&apos;ve sent a one-time login link to{" "}
                <span className="text-ink font-medium">{email.trim()}</span>.
                Open it in this browser to finish signing in.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="text-sm text-accent hover:text-accent-ink mt-6 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-2xl text-ink">Editor sign-in</h1>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                The back of house. Sign in to tend the family cookbook — we&apos;ll
                email you a one-time link.
              </p>

              <form onSubmit={handleSubmit} className="mt-6">
                <label
                  htmlFor="email"
                  className="block text-xs uppercase tracking-[0.12em] text-ink-muted mb-2"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={status === "sending"}
                  className="w-full rounded-lg border border-rule bg-background px-3 py-2.5 text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60"
                />

                {status === "error" && (
                  <p className="text-sm text-accent-ink mt-3 leading-relaxed">
                    {errorMessage ||
                      "Something went wrong. Please try again."}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full mt-5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === "sending" ? "Sending…" : "Send me a login link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-ink-muted hover:text-accent-ink transition-colors"
          >
            ← Back to the cookbook
          </Link>
        </p>
      </div>
    </main>
  );
}
