import Link from "next/link";

type Props = {
  slug: string;
};

export default function CookModeButton({ slug }: Props) {
  return (
    <Link
      href={`/recipes/${slug}/cook`}
      prefetch
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-[0_6px_18px_-10px_rgba(168,90,58,0.7)] transition-colors hover:bg-accent-ink touch-manipulation select-none"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 2v4M17 2v4M4 10h16M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
      </svg>
      <span>Cook mode</span>
    </Link>
  );
}
