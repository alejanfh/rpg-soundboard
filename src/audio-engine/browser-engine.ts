import { AudioEngine } from "./audio-engine";
import type { AudioEngineDeps } from "./types";

let instance: AudioEngine | null = null;

function createContext(): AudioContext {
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Context) throw new Error("Web Audio is not supported in this browser");
  return new Context();
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.arrayBuffer();
}

/** `window.localStorage` can throw (blocked cookies, private mode, SSR). */
function getStorage(): AudioEngineDeps["storage"] {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The app-wide engine wired to real browser APIs, created on first call.
 * Nothing here touches `window` at import time, so the module is safe to
 * import during static rendering; call it from the browser (effects/handlers).
 */
export function getBrowserEngine(): AudioEngine {
  instance ??= new AudioEngine({
    createContext,
    createMediaElement: () => new Audio(),
    fetchArrayBuffer,
    storage: getStorage(),
  });
  return instance;
}
