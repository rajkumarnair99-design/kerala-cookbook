import Link from "next/link";
import SearchBar from "./SearchBar";

export default function Header() {
  return (
    <header className="border-b border-rule bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="font-serif text-xl sm:text-2xl text-ink tracking-tight leading-none hover:text-accent-ink transition-colors"
        >
          <span className="block">Good food at home</span>
          <span className="block text-[10px] sm:text-xs font-sans uppercase tracking-[0.15em] sm:tracking-[0.2em] text-ink-muted mt-1">
            A Kerala Family Recipe Collection
          </span>
        </Link>

        <nav className="flex items-center gap-5 sm:gap-6 text-sm text-ink-soft">
          <Link
            href="/"
            className="hover:text-accent-ink transition-colors"
          >
            Home
          </Link>
          <Link
            href="/categories"
            className="hover:text-accent-ink transition-colors"
          >
            Categories
          </Link>
          <div className="hidden md:block w-64">
            <SearchBar compact />
          </div>
          <Link
            href="/search"
            className="md:hidden hover:text-accent-ink transition-colors"
            aria-label="Search recipes"
          >
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
