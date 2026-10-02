import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VOLUMES_STORAGE_KEY, type AudioEngine } from "./audio-engine";
import { createFakeDeps } from "./test-doubles";

const DOOR = { id: "door", src: "/audio/sfx/door.mp3" };

async function loadFactory() {
  vi.resetModules();
  const { getBrowserEngine } = await import("./browser-engine");
  return getBrowserEngine;
}

/** Stubs `AudioContext` with the fake and returns the handles to inspect it. */
function stubAudioContext(name: "AudioContext" | "webkitAudioContext" = "AudioContext") {
  const fake = createFakeDeps();
  vi.stubGlobal(name, function FakeCtor() {
    return fake.deps.createContext();
  });
  return fake;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getBrowserEngine", () => {
  it("is lazy: importing the module creates no engine and touches no browser API", async () => {
    const getAudioContext = vi.fn();
    vi.stubGlobal("AudioContext", getAudioContext);

    await loadFactory();

    expect(getAudioContext).not.toHaveBeenCalled();
  });

  it("returns the same instance on every call", async () => {
    const getBrowserEngine = await loadFactory();

    const first: AudioEngine = getBrowserEngine();

    expect(getBrowserEngine()).toBe(first);
    expect(first.getSnapshot().unlocked).toBe(false);
  });

  it("reads persisted volumes from window.localStorage", async () => {
    window.localStorage.setItem(
      VOLUMES_STORAGE_KEY,
      JSON.stringify({ music: 0.1, ambience: 0.2, sfx: 0.3 }),
    );
    const getBrowserEngine = await loadFactory();

    expect(getBrowserEngine().getSnapshot().volumes).toEqual({
      music: 0.1,
      ambience: 0.2,
      sfx: 0.3,
    });
  });

  it("falls back to no storage when window.localStorage throws", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const getBrowserEngine = await loadFactory();

    const engine = getBrowserEngine();
    expect(() => engine.setVolume("music", 0.9)).not.toThrow();
    expect(engine.getSnapshot().volumes.music).toBe(0.9);
    vi.restoreAllMocks();
  });

  it("creates the AudioContext from window.AudioContext on unlock", async () => {
    const fake = stubAudioContext();
    const getBrowserEngine = await loadFactory();
    const engine = getBrowserEngine();

    await engine.unlock();

    expect(fake.contexts).toHaveLength(1);
    expect(engine.getSnapshot().unlocked).toBe(true);
  });

  it("falls back to webkitAudioContext", async () => {
    const fake = stubAudioContext("webkitAudioContext");
    vi.stubGlobal("AudioContext", undefined);
    const getBrowserEngine = await loadFactory();
    const engine = getBrowserEngine();

    await engine.unlock();

    expect(fake.contexts).toHaveLength(1);
    expect(engine.getSnapshot().unlocked).toBe(true);
  });

  it("stays locked, without throwing, when the browser has no Web Audio", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const getBrowserEngine = await loadFactory();
    const engine = getBrowserEngine();

    await expect(engine.unlock()).resolves.toBeUndefined();

    expect(engine.getSnapshot().unlocked).toBe(false);
  });

  it("fetches sfx with fetch() and treats a non-ok response as a failed sound", async () => {
    stubAudioContext();
    const fetchMock = vi.fn(async (url: string) =>
      url === DOOR.src
        ? { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) }
        : { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) },
    );
    vi.stubGlobal("fetch", fetchMock);
    const getBrowserEngine = await loadFactory();
    const engine = getBrowserEngine();
    await engine.unlock();

    await engine.preloadSfx([DOOR, { id: "missing", src: "/audio/sfx/missing.mp3" }]);

    expect(fetchMock).toHaveBeenCalledWith(DOOR.src);
    expect(engine.getSnapshot().failed).toEqual(["missing"]);
  });

  it("creates track decks with new Audio()", async () => {
    stubAudioContext();
    const created: unknown[] = [];
    vi.stubGlobal(
      "Audio",
      function FakeAudio() {
        const element = { addEventListener: vi.fn(), play: vi.fn(async () => {}) };
        created.push(element);
        return element;
      },
    );
    const getBrowserEngine = await loadFactory();
    const engine = getBrowserEngine();
    await engine.unlock();

    engine.setTrack("music", { id: "a", src: "/audio/music/a.mp3" });

    expect(created).toHaveLength(2);
  });
});
