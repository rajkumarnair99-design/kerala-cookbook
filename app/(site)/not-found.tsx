import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="text-xs uppercase tracking-[0.25em] text-accent-ink mb-4">
        Not found
      </div>
      <h1 className="font-serif text-4xl sm:text-5xl text-ink leading-tight">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-6 text-ink-soft">
        The recipe or section you&rsquo;re looking for isn&rsquo;t in the book
        yet.
      </p>
      <Link
        href="/"
        className="inline-block mt-8 rounded-full border border-rule bg-surface px-5 py-2.5 text-sm text-ink-soft hover:border-accent-soft hover:text-accent-ink transition-colors"
      >
        Back to the cookbook
      </Link>
    </div>
  );
}
