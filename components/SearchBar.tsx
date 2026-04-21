"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  compact?: boolean;
  initialQuery?: string;
  autoFocus?: boolean;
};

export default function SearchBar({
  compact = false,
  initialQuery = "",
  autoFocus = false,
}: Props) {
  const [value, setValue] = useState(initialQuery);
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <form onSubmit={onSubmit} role="search" className="w-full">
      <label className="sr-only" htmlFor="site-search">
        Search recipes
      </label>
      <div
        className={`flex items-center gap-2 border border-rule bg-surface rounded-full transition-colors focus-within:border-accent-soft focus-within:ring-2 focus-within:ring-accent-soft/20 ${
          compact ? "px-3 py-1.5" : "px-4 py-3"
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-ink-muted flex-none`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="site-search"
          type="search"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          placeholder={compact ? "Search recipes…" : "Search by name, tag, or ingredient…"}
          className={`w-full bg-transparent outline-none placeholder:text-ink-muted/70 ${
            compact ? "text-sm" : "text-base"
          }`}
        />
      </div>
    </form>
  );
}
