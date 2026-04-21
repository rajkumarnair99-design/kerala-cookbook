"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  minutes: number;
};

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Timer({ minutes }: Props) {
  const preset = minutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(preset);
  const [running, setRunning] = useState(false);
  const finishedPulsedRef = useRef(false);

  // Reset when preset changes (navigating between steps)
  useEffect(() => {
    setSecondsLeft(preset);
    setRunning(false);
    finishedPulsedRef.current = false;
  }, [preset]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const done = secondsLeft === 0;

  const toggle = () => {
    if (done) {
      setSecondsLeft(preset);
      setRunning(true);
      finishedPulsedRef.current = false;
      return;
    }
    setRunning((r) => !r);
  };

  const reset = () => {
    setRunning(false);
    setSecondsLeft(preset);
    finishedPulsedRef.current = false;
  };

  return (
    <div
      className={`mt-4 flex items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 transition-colors ${
        done
          ? "border-accent bg-accent/5"
          : "border-rule bg-surface"
      }`}
      role="timer"
      aria-live="polite"
    >
      <div className="flex items-baseline gap-3">
        <span
          className={`font-serif tabular-nums text-3xl sm:text-4xl leading-none ${
            done ? "text-accent-ink" : "text-ink"
          }`}
        >
          {format(secondsLeft)}
        </span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">
          {done ? "Time's up" : running ? "Running" : "Timer"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="min-h-[44px] rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-background hover:bg-accent-ink transition-colors touch-manipulation select-none"
        >
          {done ? "Restart" : running ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!running && secondsLeft === preset}
          className="min-h-[44px] rounded-full border border-rule bg-surface px-5 py-2.5 text-sm text-ink-soft hover:border-accent-soft hover:text-accent-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation select-none"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
