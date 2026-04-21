import type { Step } from "@/types/recipe";

type Props = {
  steps: Step[];
};

function formatTimer(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export default function StepList({ steps }: Props) {
  return (
    <ol className="space-y-8">
      {steps.map((step) => (
        <li key={step.step_number} className="flex gap-5">
          <div className="flex-none">
            <div className="font-serif text-2xl text-accent-ink tabular-nums leading-none">
              {String(step.step_number).padStart(2, "0")}
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-ink leading-relaxed text-base sm:text-lg">
              {step.instruction}
            </p>
            {step.timer_minutes !== null && (
              <div className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <span>{formatTimer(step.timer_minutes)}</span>
              </div>
            )}
            {step.tip && (
              <div className="border-l-2 border-accent-soft/60 pl-4 py-1">
                <div className="text-[11px] uppercase tracking-[0.2em] text-accent-ink mb-1">
                  Tip
                </div>
                <p className="text-sm text-ink-soft italic leading-relaxed">
                  {step.tip}
                </p>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
