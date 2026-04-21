"use client";

import { useState } from "react";

export default function FavoriteButton({ label = "Favorite" }: { label?: string }) {
  const [isFavorite, setIsFavorite] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setIsFavorite((f) => !f)}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 py-3 text-sm transition-colors touch-manipulation select-none ${
        isFavorite
          ? "border-accent bg-accent text-white"
          : "border-rule bg-surface text-ink-soft hover:border-accent-soft hover:text-accent-ink"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span>{isFavorite ? "Saved" : label}</span>
    </button>
  );
}
