"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the screen awake while `active`, re-acquiring the lock when the page
 * becomes visible again (browsers drop it on hide). Silently does nothing
 * where the Screen Wake Lock API is missing or refuses.
 *
 * Returns a stable `request()` that asks for the lock right now. Call it from
 * a user gesture: some browsers only grant the lock after one.
 */
export function useWakeLock(active: boolean): () => void {
  const requestRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const release = (lock: WakeLockSentinel | null) => {
      lock?.release().catch(() => {});
    };

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (disposed) {
          release(lock);
          return;
        }
        release(sentinel);
        sentinel = lock;
      } catch {
        // Not allowed (battery saver, hidden page, permissions policy): ignore.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void request();
    };

    requestRef.current = () => void request();
    void request();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      requestRef.current = () => {};
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release(sentinel);
      sentinel = null;
    };
  }, [active]);

  return useCallback(() => requestRef.current(), []);
}
