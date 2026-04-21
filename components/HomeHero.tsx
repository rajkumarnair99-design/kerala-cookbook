export default function HomeHero() {
  return (
    <section
      aria-labelledby="home-title"
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-rule/70"
    >
      {/* Base warm gradient */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #f6e7d3 0%, #efd4b8 40%, #dcab85 100%)",
        }}
      />
      {/* Soft highlight wash */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 85% 15%, rgba(255,242,222,0.55), transparent 60%)",
        }}
      />
      {/* Subtle dot pattern */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-[0.15] mix-blend-multiply"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="hero-dots"
            x="0"
            y="0"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#7a3f28" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>

      {/* Decorative botanical sprig, bottom right */}
      <svg
        aria-hidden
        viewBox="0 0 240 240"
        className="pointer-events-none absolute -bottom-6 -right-6 w-48 sm:w-64 md:w-80 text-accent-ink/25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M40 210 C 80 170, 120 140, 160 90 C 180 60, 195 40, 210 25" />
        <path d="M72 165 C 60 160, 52 150, 50 138 C 64 136, 78 144, 84 156 Z" />
        <path d="M100 138 C 86 134, 78 122, 77 108 C 92 108, 106 118, 110 132 Z" />
        <path d="M130 106 C 116 104, 106 92, 106 78 C 122 80, 134 92, 138 104 Z" />
        <path d="M158 76 C 146 74, 136 62, 138 48 C 154 50, 166 60, 168 74 Z" />
        <path d="M86 178 C 94 192, 108 198, 120 194 C 118 180, 104 170, 90 170 Z" />
        <path d="M114 150 C 124 162, 138 166, 150 160 C 146 148, 132 140, 118 144 Z" />
        <path d="M144 120 C 154 130, 168 132, 178 126 C 174 114, 160 108, 148 114 Z" />
      </svg>

      {/* Content */}
      <div className="relative z-10 px-6 py-16 sm:px-12 sm:py-24 md:py-32 lg:py-40 max-w-2xl">
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-accent-ink mb-5 sm:mb-6">
          A Kerala Family Archive
        </div>
        <h1
          id="home-title"
          className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[68px] leading-[1.05] tracking-tight text-ink"
        >
          Good food at home
        </h1>
        <p className="mt-6 text-base sm:text-lg md:text-xl text-ink-soft leading-relaxed max-w-xl">
          A Kerala family recipe collection, passed down and now gathered here.
        </p>
      </div>
    </section>
  );
}
