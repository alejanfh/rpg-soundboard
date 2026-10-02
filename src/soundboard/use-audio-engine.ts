"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_VOLUMES, type AudioEngine, type EngineSnapshot } from "@/audio-engine";
import { getBrowserEngine } from "@/audio-engine/browser-engine";

/** What the server (and the hydrating client) renders: a locked engine. */
const SERVER_SNAPSHOT: EngineSnapshot = Object.freeze({
  unlocked: false,
  silenced: false,
  volumes: { ...DEFAULT_VOLUMES },
  current: {},
  failed: [],
});

// React only calls these on the client, so the engine is never built while prerendering.
const subscribe = (listener: () => void) => getBrowserEngine().subscribe(listener);
const getSnapshot = () => getBrowserEngine().getSnapshot();
const getServerSnapshot = () => SERVER_SNAPSHOT;

/**
 * A stable stand-in for the browser engine that builds it on first use.
 * Holding or destructuring it during render (or prerender) creates nothing;
 * the real engine only comes to life when a method is called, i.e. inside
 * effects and event handlers.
 */
const lazyEngine = new Proxy({} as AudioEngine, {
  get(_target, property) {
    const engine = getBrowserEngine();
    const value: unknown = Reflect.get(engine, property, engine);
    return typeof value === "function" ? value.bind(engine) : value;
  },
});

/** Engine state for rendering, plus a stable handle to the engine. */
export function useAudioEngine(): { engine: AudioEngine; snapshot: EngineSnapshot } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { engine: lazyEngine, snapshot };
}
