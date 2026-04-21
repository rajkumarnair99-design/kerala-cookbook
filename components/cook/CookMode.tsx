"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import IngredientList from "@/components/IngredientList";
import StepPhoto from "@/components/StepPhoto";
import VideoPanel from "@/components/VideoPanel";
import Timer from "./Timer";
import type { Recipe } from "@/types/recipe";

type Props = {
  recipe: Recipe;
};

// screen = 0 → intro card; 1..n → step n
export default function CookMode({ recipe }: Props) {
  const router = useRouter();
  const totalSteps = recipe.steps.length;
  const [screen, setScreen] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const exitHref = `/recipes/${recipe.slug}`;

  const goNext = useCallback(() => {
    if (screen < totalSteps) {
      setScreen((s) => s + 1);
      return;
    }
    // last step → done, return to recipe
    router.push(exitHref);
  }, [screen, totalSteps, router, exitHref]);

  const goBack = useCallback(() => {
    if (screen > 0) setScreen((s) => s - 1);
  }, [screen]);

  // Keyboard nav + ESC closes modals or exits cook mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showVideo) return setShowVideo(false);
        if (showIngredients) return setShowIngredients(false);
        router.push(exitHref);
        return;
      }
      if (showVideo || showIngredients) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showVideo, showIngredients, router, exitHref, goNext, goBack]);

  // Lock page scroll when a modal is open
  useEffect(() => {
    if (showVideo || showIngredients) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showVideo, showIngredients]);

  const onIntro = screen === 0;
  const onLastStep = screen === totalSteps;
  const currentStep = onIntro ? null : recipe.steps[screen - 1];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-rule/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <Link
            href={exitHref}
            prefetch
            aria-label="Exit cook mode"
            className="flex-none flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-surface text-ink-soft hover:border-accent-soft hover:text-accent-ink transition-colors touch-manipulation select-none"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="font-serif text-base sm:text-lg text-ink leading-tight truncate">
              {recipe.title}
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-ink-muted mt-0.5">
              {onIntro
                ? "Intro"
                : `Step ${screen} of ${totalSteps}`}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="flex-none inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-rule bg-surface px-4 py-2.5 text-xs text-ink-soft hover:border-accent-soft hover:text-accent-ink transition-colors touch-manipulation select-none"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="currentColor"
            >
              <path d="M7 5.5v13a1 1 0 0 0 1.54.84l11-6.5a1 1 0 0 0 0-1.68l-11-6.5A1 1 0 0 0 7 5.5Z" />
            </svg>
            <span>Video</span>
          </button>
        </div>

        {/* Progress bar */}
        <div
          aria-hidden
          className="h-0.5 w-full bg-rule/70"
        >
          <div
            className="h-full bg-accent transition-[width] duration-500"
            style={{
              width: `${(screen / totalSteps) * 100}%`,
            }}
          />
        </div>
      </header>

      {/* Screen content */}
      <div className="flex-1 w-full">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-10 pb-44">
          {onIntro ? (
            <IntroScreen recipe={recipe} onVideo={() => setShowVideo(true)} />
          ) : currentStep ? (
            <StepScreen
              step={currentStep}
              stepNumber={screen}
              total={totalSteps}
              recipeTitle={recipe.title}
            />
          ) : null}
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-10 border-t border-rule/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="mx-auto max-w-3xl px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
          }}
        >
          <button
            type="button"
            onClick={() => setShowIngredients(true)}
            aria-label="View ingredients"
            className="flex-none flex h-12 w-12 items-center justify-center rounded-full border border-rule bg-surface text-ink-soft hover:border-accent-soft hover:text-accent-ink transition-colors touch-manipulation select-none"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </button>

          <button
            type="button"
            onClick={goBack}
            disabled={onIntro}
            className="flex-1 h-12 rounded-full border border-rule bg-surface text-ink-soft font-medium hover:border-accent-soft hover:text-accent-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation select-none"
          >
            Back
          </button>

          <button
            type="button"
            onClick={goNext}
            className="flex-[2] h-12 rounded-full bg-accent text-white font-medium shadow-[0_8px_20px_-10px_rgba(168,90,58,0.7)] hover:bg-accent-ink transition-colors touch-manipulation select-none"
          >
            {onIntro ? "Start cooking" : onLastStep ? "Done" : "Next step"}
          </button>
        </div>
      </nav>

      {/* Ingredients bottom sheet */}
      {showIngredients && (
        <BottomSheet
          title="Ingredients"
          onClose={() => setShowIngredients(false)}
        >
          <div className="text-sm text-ink-muted mb-4">
            Serves {recipe.serves}
          </div>
          <IngredientList ingredients={recipe.ingredients} />
        </BottomSheet>
      )}

      {/* Video modal */}
      {showVideo && (
        <VideoModal
          videoUrl={recipe.video_url}
          title={recipe.title}
          onClose={() => setShowVideo(false)}
        />
      )}
    </div>
  );
}

function IntroScreen({
  recipe,
  onVideo,
}: {
  recipe: Recipe;
  onVideo: () => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent-ink mb-3">
          Cook mode
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-ink leading-[1.1] tracking-tight">
          {recipe.title}
        </h1>
        <p className="mt-3 text-base sm:text-lg text-ink-soft italic font-serif leading-relaxed">
          {recipe.subtitle}
        </p>
        <div className="mt-4 text-sm text-ink-muted">
          Serves {recipe.serves} · {recipe.steps.length}{" "}
          {recipe.steps.length === 1 ? "step" : "steps"}
        </div>
      </div>

      <button type="button" onClick={onVideo} className="block w-full text-left">
        <VideoPanel videoUrl={recipe.video_url} title={recipe.title} />
      </button>

      {recipe.notes && (
        <aside className="rounded-xl border border-rule bg-surface p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-accent-ink mb-2">
            Notes
          </div>
          <p className="text-ink-soft italic font-serif leading-relaxed">
            {recipe.notes}
          </p>
        </aside>
      )}

      <p className="text-sm text-ink-muted">
        Tap <span className="text-ink-soft">Start cooking</span> when you&rsquo;re
        ready. Use the list icon at the bottom to peek at ingredients anytime.
      </p>
    </div>
  );
}

function StepScreen({
  step,
  stepNumber,
  total,
  recipeTitle,
}: {
  step: import("@/types/recipe").Step;
  stepNumber: number;
  total: number;
  recipeTitle: string;
}) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <StepPhoto step={step} recipeTitle={recipeTitle} />

      <div>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-serif text-3xl sm:text-4xl text-accent-ink tabular-nums leading-none">
            {String(stepNumber).padStart(2, "0")}
          </span>
          <span className="text-[11px] uppercase tracking-[0.25em] text-ink-muted">
            of {String(total).padStart(2, "0")}
          </span>
        </div>

        <p className="text-ink leading-relaxed text-xl sm:text-2xl font-serif">
          {step.instruction}
        </p>

        {step.timer_minutes !== null && step.timer_minutes > 0 && (
          <Timer minutes={step.timer_minutes} />
        )}

        {step.tip && (
          <div className="mt-6 border-l-2 border-accent-soft/70 pl-4 py-1">
            <div className="text-[11px] uppercase tracking-[0.2em] text-accent-ink mb-1">
              Tip
            </div>
            <p className="text-base text-ink-soft italic leading-relaxed font-serif">
              {step.tip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-background rounded-t-3xl sm:rounded-3xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:w-[92vw] max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-[0_-10px_40px_-10px_rgba(43,37,32,0.3)]"
        style={{
          animation: "sheetIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-rule">
          <h2 className="font-serif text-xl text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-surface text-ink-soft hover:border-accent-soft hover:text-accent-ink transition-colors touch-manipulation select-none"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div
          className="overflow-y-auto px-5 sm:px-6 py-5 flex-1"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function VideoModal({
  videoUrl,
  title,
  onClose,
}: {
  videoUrl?: string | null;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} video`}
    >
      <button
        type="button"
        aria-label="Close video"
        onClick={onClose}
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-serif text-base sm:text-lg text-background/90 truncate pr-4">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-none flex h-11 w-11 items-center justify-center rounded-full border border-background/40 bg-background/10 text-background hover:bg-background/20 transition-colors touch-manipulation select-none"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <VideoPanel videoUrl={videoUrl} title={title} />
      </div>
    </div>
  );
}
