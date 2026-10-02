"use client";

import { useEffect, useRef, useState } from "react";
import type { Sound } from "@/sound-library";

export const TOAST_DURATION_MS = 5000;

interface FailureToastsProps {
  failed: readonly string[];
  lookup: (id: string) => Sound | undefined;
}

/**
 * Announces each sound that failed to load, once, then dismisses it after a
 * few seconds. The live region stays mounted so screen readers pick it up.
 */
export function FailureToasts({ failed, lookup }: FailureToastsProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const visible = failed.filter((id) => !dismissed.has(id));

  useEffect(() => {
    for (const id of failed) {
      if (dismissed.has(id) || timers.current.has(id)) continue;
      const timer = setTimeout(() => {
        setDismissed((previous) => new Set(previous).add(id));
      }, TOAST_DURATION_MS);
      timers.current.set(id, timer);
    }
  }, [failed, dismissed]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-3 z-40 flex flex-col items-center gap-2 px-4"
    >
      {visible.map((id) => (
        <p
          key={id}
          className="rounded-md border border-coral/60 bg-abyss px-4 py-2 text-base text-coral shadow-lg"
        >
          No se pudo cargar: {lookup(id)?.title ?? id}
        </p>
      ))}
    </div>
  );
}
