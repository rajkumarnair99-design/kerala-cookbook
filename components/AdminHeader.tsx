import Link from "next/link";

/**
 * The back-of-house header shown on every /admin page. It mirrors the
 * public site's Header so the editor feels like the same shop.
 */
export default function AdminHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-rule bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Link
          href="/admin"
          className="font-serif text-lg sm:text-xl text-ink tracking-tight leading-none hover:text-accent-ink transition-colors"
        >
          <span className="block">Good food at home</span>
          <span className="block text-[10px] uppercase tracking-[0.2em] text-ink-muted mt-1">
            Cookbook editor
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {email && (
            <span className="hidden sm:inline text-ink-muted">{email}</span>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-ink-soft hover:text-accent-ink transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
