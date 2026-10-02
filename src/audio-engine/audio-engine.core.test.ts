import { describe, expect, it, vi } from "vitest";
import {
  AudioEngine,
  DEFAULT_VOLUMES,
  SILENCE_FADE_SECONDS,
  VOLUMES_STORAGE_KEY,
} from "./audio-engine";
import {
  asFakeGain,
  createFakeDeps,
  type FakeDepsOptions,
} from "./test-doubles";

function setup(options?: FakeDepsOptions) {
  const fake = createFakeDeps(options);
  const engine = new AudioEngine(fake.deps);
  return { fake, engine };
}

describe("AudioEngine core", () => {
  it("starts locked with default volumes", () => {
    const { engine, fake } = setup();

    expect(engine.getSnapshot()).toEqual({
      unlocked: false,
      silenced: false,
      volumes: DEFAULT_VOLUMES,
      current: {},
      failed: [],
    });
    expect(fake.contexts).toHaveLength(0);
  });

  it("unlock creates one context, resumes it, and sets unlocked", async () => {
    const { engine, fake } = setup();

    await engine.unlock();
    await engine.unlock();

    expect(fake.contexts).toHaveLength(1);
    expect(fake.context.resumeCalls).toBeGreaterThanOrEqual(1);
    expect(fake.context.state).toBe("running");
    expect(engine.getSnapshot().unlocked).toBe(true);
  });

  it("unlock builds buses into master into destination with user volumes", async () => {
    const { engine, fake } = setup();

    await engine.unlock();

    const graph = engine.getGraph();
    expect(graph).not.toBeNull();
    const { master, buses } = graph!;
    const fakeMaster = asFakeGain(master);
    expect(fakeMaster.connections).toEqual([fake.context.destination]);
    expect(fakeMaster.gain.value).toBe(1);
    for (const layer of ["music", "ambience", "sfx"] as const) {
      const bus = asFakeGain(buses[layer]);
      expect(bus.connections).toEqual([fakeMaster]);
      expect(bus.gain.value).toBe(DEFAULT_VOLUMES[layer]);
    }
  });

  it("unlock does not reject when the context cannot be resumed", async () => {
    const { engine, fake } = setup();
    // The context only exists after unlock starts, so fail every new one.
    const create = fake.deps.createContext;
    fake.deps.createContext = () => {
      const context = create();
      (context as unknown as { resumeError: Error }).resumeError = new Error(
        "blocked",
      );
      return context;
    };

    await expect(engine.unlock()).resolves.toBeUndefined();

    expect(engine.getSnapshot().unlocked).toBe(false);
  });

  it("setVolume clamps to 0..1, updates the bus gain, persists to storage, and notifies subscribers", async () => {
    const { engine, fake } = setup();
    await engine.unlock();
    const listener = vi.fn();
    engine.subscribe(listener);
    const musicBus = asFakeGain(engine.getGraph()!.buses.music);

    engine.setVolume("music", 0.25);
    expect(musicBus.gain.value).toBe(0.25);
    expect(engine.getSnapshot().volumes.music).toBe(0.25);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fake.storage!.getItem(VOLUMES_STORAGE_KEY)!)).toEqual({
      ...DEFAULT_VOLUMES,
      music: 0.25,
    });

    engine.setVolume("music", 5);
    expect(engine.getSnapshot().volumes.music).toBe(1);
    expect(musicBus.gain.value).toBe(1);

    engine.setVolume("music", -2);
    expect(engine.getSnapshot().volumes.music).toBe(0);
    expect(musicBus.gain.value).toBe(0);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("setVolume ignores non-finite values and does not notify for unchanged values", () => {
    const { engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.setVolume("sfx", Number.NaN);
    engine.setVolume("sfx", DEFAULT_VOLUMES.sfx);

    expect(listener).not.toHaveBeenCalled();
    expect(engine.getSnapshot().volumes.sfx).toBe(DEFAULT_VOLUMES.sfx);
  });

  it("setVolume before unlock updates snapshot and storage, and applies on unlock", async () => {
    const { engine, fake } = setup();

    engine.setVolume("ambience", 0.1);

    expect(engine.getSnapshot().volumes.ambience).toBe(0.1);
    expect(JSON.parse(fake.storage!.getItem(VOLUMES_STORAGE_KEY)!).ambience).toBe(
      0.1,
    );

    await engine.unlock();

    expect(asFakeGain(engine.getGraph()!.buses.ambience).gain.value).toBe(0.1);
  });

  it("unsubscribe stops notifications", () => {
    const { engine } = setup();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    unsubscribe();
    engine.setVolume("music", 0.9);

    expect(listener).not.toHaveBeenCalled();
  });

  it("loads persisted volumes on construction", () => {
    const { engine } = setup({
      initialStorage: {
        [VOLUMES_STORAGE_KEY]: JSON.stringify({
          music: 0.1,
          ambience: 0.2,
          sfx: 0.3,
        }),
      },
    });

    expect(engine.getSnapshot().volumes).toEqual({
      music: 0.1,
      ambience: 0.2,
      sfx: 0.3,
    });
  });

  it("falls back to defaults when storage is null", () => {
    const { engine } = setup({ storage: null });

    expect(engine.getSnapshot().volumes).toEqual(DEFAULT_VOLUMES);
    expect(() => engine.setVolume("music", 0.4)).not.toThrow();
    expect(engine.getSnapshot().volumes.music).toBe(0.4);
  });

  it("falls back to defaults when storage throws", () => {
    const { engine } = setup({
      storage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
    });

    expect(engine.getSnapshot().volumes).toEqual(DEFAULT_VOLUMES);
    expect(() => engine.setVolume("music", 0.4)).not.toThrow();
    expect(engine.getSnapshot().volumes.music).toBe(0.4);
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a non-object", "42"],
    ["null", "null"],
    ["an array", "[1,2,3]"],
  ])("falls back to defaults when storage holds %s", (_label, raw) => {
    const { engine } = setup({ initialStorage: { [VOLUMES_STORAGE_KEY]: raw } });

    expect(engine.getSnapshot().volumes).toEqual(DEFAULT_VOLUMES);
  });

  it("falls back per layer for missing, out-of-range or non-numeric values", () => {
    const { engine } = setup({
      initialStorage: {
        [VOLUMES_STORAGE_KEY]: JSON.stringify({
          music: 1.5,
          ambience: "loud",
          sfx: 0.7,
        }),
      },
    });

    expect(engine.getSnapshot().volumes).toEqual({
      music: DEFAULT_VOLUMES.music,
      ambience: DEFAULT_VOLUMES.ambience,
      sfx: 0.7,
    });
  });

  it("silence ramps master to 0 over SILENCE_FADE_SECONDS and resume ramps back to 1; snapshot.silenced toggles", async () => {
    const { engine, fake } = setup();
    await engine.unlock();
    const master = asFakeGain(engine.getGraph()!.master);
    fake.context.currentTime = 10;

    engine.silence();

    expect(engine.getSnapshot().silenced).toBe(true);
    expect(master.gain.calls).toEqual([
      { type: "cancelScheduledValues", time: 10 },
      { type: "setValueAtTime", value: 1, time: 10 },
      {
        type: "linearRampToValueAtTime",
        value: 0,
        time: 10 + SILENCE_FADE_SECONDS,
      },
    ]);
    expect(master.gain.settledValue).toBe(0);

    fake.context.currentTime = 20;
    master.gain.calls.length = 0;
    engine.resume();

    expect(engine.getSnapshot().silenced).toBe(false);
    expect(master.gain.calls.at(-1)).toEqual({
      type: "linearRampToValueAtTime",
      value: 1,
      time: 20 + SILENCE_FADE_SECONDS,
    });
    expect(master.gain.settledValue).toBe(1);
  });

  it("silence leaves bus volumes untouched", async () => {
    const { engine } = setup();
    await engine.unlock();

    engine.silence();

    for (const layer of ["music", "ambience", "sfx"] as const) {
      const bus = asFakeGain(engine.getGraph()!.buses[layer]);
      expect(bus.gain.calls).toEqual([]);
      expect(bus.gain.value).toBe(DEFAULT_VOLUMES[layer]);
    }
  });

  it("silence and resume are no-ops before unlock or when already in that state", async () => {
    const { engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.silence();
    engine.resume();
    expect(engine.getSnapshot().silenced).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    await engine.unlock();
    listener.mockClear();

    engine.resume();
    expect(listener).not.toHaveBeenCalled();

    engine.silence();
    engine.silence();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each(["interrupted", "suspended"] as const)(
    "context state change to %s sets unlocked false, and running sets it back",
    async (state) => {
      const { engine, fake } = setup();
      await engine.unlock();
      expect(engine.getSnapshot().unlocked).toBe(true);
      const listener = vi.fn();
      engine.subscribe(listener);

      fake.context.setState(state);

      expect(engine.getSnapshot().unlocked).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);

      await engine.unlock();

      expect(fake.contexts).toHaveLength(1);
      expect(engine.getSnapshot().unlocked).toBe(true);
    },
  );

  it("getSnapshot returns the same object until something changes", async () => {
    const { engine } = setup();

    const first = engine.getSnapshot();
    expect(engine.getSnapshot()).toBe(first);

    await engine.unlock();
    const afterUnlock = engine.getSnapshot();
    expect(afterUnlock).not.toBe(first);
    expect(engine.getSnapshot()).toBe(afterUnlock);

    engine.setVolume("music", 0.33);
    const afterVolume = engine.getSnapshot();
    expect(afterVolume).not.toBe(afterUnlock);
    expect(engine.getSnapshot()).toBe(afterVolume);
  });
});
