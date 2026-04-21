import type { Step } from "@/types/recipe";

type Props = {
  step: Step;
  recipeTitle: string;
};

export default function StepPhoto({ step, recipeTitle }: Props) {
  const images = step.image_urls ?? [];

  if (images.length === 0) {
    return (
      <figure className="relative">
        <div className="relative overflow-hidden rounded-xl aspect-[4/3] shadow-[0_1px_2px_rgba(43,37,32,0.04),0_12px_28px_-18px_rgba(168,90,58,0.4)]">
          <Placeholder stepNumber={step.step_number} />
        </div>
      </figure>
    );
  }

  return (
    <div className="space-y-3">
      {images.map((src, idx) => (
        <figure key={src} className="relative">
          <div className="relative overflow-hidden rounded-xl aspect-[4/3] shadow-[0_1px_2px_rgba(43,37,32,0.04),0_12px_28px_-18px_rgba(168,90,58,0.4)]">
            {/* Using a plain <img> for arbitrary external URLs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={
                images.length > 1
                  ? `${recipeTitle} — step ${step.step_number} (${idx + 1} of ${images.length})`
                  : `${recipeTitle} — step ${step.step_number}`
              }
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </figure>
      ))}
    </div>
  );
}

function Placeholder({ stepNumber }: { stepNumber: number }) {
  return (
    <>
      {/* Warm base gradient */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, #f5e2c9 0%, #ecd0b2 55%, #d8ad85 100%)",
        }}
      />
      {/* Soft highlight */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 30% 15%, rgba(255,245,228,0.55), transparent 60%)",
        }}
      />
      {/* Subtle dot pattern */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-[0.12] mix-blend-multiply"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`dots-${stepNumber}`}
            x="0"
            y="0"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#7a3f28" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots-${stepNumber})`} />
      </svg>
      {/* Caption */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-accent-ink/70">
        <div className="flex items-center gap-1.5 opacity-80">
          <span className="block w-1 h-1 rounded-full bg-current" />
          <span className="block w-1 h-1 rounded-full bg-current" />
          <span className="block w-1 h-1 rounded-full bg-current" />
        </div>
        <span className="font-serif italic text-sm tracking-[0.05em]">
          Step {stepNumber}
        </span>
      </div>
    </>
  );
}
