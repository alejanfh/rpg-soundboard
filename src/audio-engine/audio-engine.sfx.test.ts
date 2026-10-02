import { describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./audio-engine";
import { createFakeDeps, type FakeAudioNode } from "./test-doubles";

const DOOR = { id: "door", src: "/audio/sfx/door.mp3" };
const SHOT = { id: "shot", src: "/audio/sfx/shot.mp3" };

async function setup() {
  const fake = createFakeDeps();
  const engine = new AudioEngine(fake.deps);
  await engine.unlock();
  return { fake, engine };
}

function sfxBus(engine: AudioEngine): FakeAudioNode {
  return engine.getGraph()?.buses.sfx as unknown as FakeAudioNode;
}

describe("AudioEngine sfx", () => {
  it("preloadSfx fetches and decodes each sound once", async () => {
    const { engine, fake } = await setup();
    const decode = vi.spyOn(fake.context, "decodeAudioData");

    await engine.preloadSfx([DOOR, SHOT, DOOR]);
    await engine.preloadSfx([DOOR, SHOT]);

    expect(fake.fetchedUrls).toEqual([DOOR.src, SHOT.src]);
    expect(decode).toHaveBeenCalledTimes(2);
    expect(fake.bufferSources).toHaveLength(0);
    expect(engine.getSnapshot().failed).toEqual([]);
  });

  it("playSfx uses the cached buffer and starts a new buffer source on the sfx bus", async () => {
    const { engine, fake } = await setup();
    await engine.preloadSfx([DOOR]);

    const playing = engine.playSfx(DOOR);

    // A cached sound starts synchronously, before the promise is even awaited.
    expect(fake.bufferSources).toHaveLength(1);
    await playing;
    const [source] = fake.bufferSources;
    expect(source.buffer).toEqual({ duration: 1, byteLength: 8 });
    expect(source.loop).toBe(false);
    expect(source.startCalls).toHaveLength(1);
    expect(source.connections).toEqual([sfxBus(engine)]);
    expect(fake.fetchedUrls).toEqual([DOOR.src]);
  });

  it("playSfx on an uncached sound fetches lazily then plays", async () => {
    const { engine, fake } = await setup();

    await engine.playSfx(SHOT);

    expect(fake.fetchedUrls).toEqual([SHOT.src]);
    expect(fake.bufferSources).toHaveLength(1);
    expect(fake.bufferSources[0].startCalls).toHaveLength(1);
    expect(fake.bufferSources[0].connections).toEqual([sfxBus(engine)]);
  });

  it("the same sfx played twice creates two overlapping sources", async () => {
    const { engine, fake } = await setup();

    await engine.playSfx(DOOR);
    await engine.playSfx(DOOR);

    expect(fake.fetchedUrls).toEqual([DOOR.src]);
    expect(fake.bufferSources).toHaveLength(2);
    const [first, second] = fake.bufferSources;
    expect(first).not.toBe(second);
    expect(first.stopCalls).toBe(0);
    expect(second.startCalls).toHaveLength(1);
  });

  it("concurrent loads of the same sound share one fetch", async () => {
    const { engine, fake } = await setup();

    await Promise.all([
      engine.playSfx(DOOR),
      engine.playSfx(DOOR),
      engine.preloadSfx([DOOR]),
    ]);

    expect(fake.fetchedUrls).toEqual([DOOR.src]);
    expect(fake.bufferSources).toHaveLength(2);
  });

  it("stopAllSfx stops every active source; ended sources are forgotten", async () => {
    const { engine, fake } = await setup();
    await engine.playSfx(DOOR);
    await engine.playSfx(SHOT);
    await engine.playSfx(DOOR);
    const [first, second, third] = fake.bufferSources;

    first.emitEnded();
    engine.stopAllSfx();

    expect(first.stopCalls).toBe(0);
    expect(second.stopCalls).toBe(1);
    expect(third.stopCalls).toBe(1);

    // A source that ends after being stopped does not break anything, and
    // a second stop has nothing left to stop.
    second.emitEnded();
    engine.stopAllSfx();
    expect(second.stopCalls).toBe(1);
    expect(third.stopCalls).toBe(1);
  });

  it("stopAllSfx does not throw when a source refuses to stop", async () => {
    const { engine, fake } = await setup();
    await engine.playSfx(DOOR);
    await engine.playSfx(SHOT);
    fake.bufferSources[0].stop = () => {
      throw new Error("InvalidStateError");
    };

    expect(() => engine.stopAllSfx()).not.toThrow();
    expect(fake.bufferSources[1].stopCalls).toBe(1);
  });

  it("stopAllSfx before unlock is a no-op", () => {
    const engine = new AudioEngine(createFakeDeps().deps);

    expect(() => engine.stopAllSfx()).not.toThrow();
  });

  it("stopAll also stops active sfx", async () => {
    const { engine, fake } = await setup();
    await engine.playSfx(DOOR);

    engine.stopAll();

    expect(fake.bufferSources[0].stopCalls).toBe(1);
  });

  it("a sound still loading when stopAllSfx runs does not start afterwards", async () => {
    const { engine, fake } = await setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchNow = fake.deps.fetchArrayBuffer;
    fake.deps.fetchArrayBuffer = async (url) => {
      await gate;
      return fetchNow(url);
    };

    const playing = engine.playSfx(DOOR);
    engine.stopAllSfx();
    release();
    await playing;

    expect(fake.bufferSources).toHaveLength(0);
    // The buffer is still cached for the next press.
    await engine.playSfx(DOOR);
    expect(fake.bufferSources).toHaveLength(1);
    expect(fake.fetchedUrls).toEqual([DOOR.src]);
  });

  describe("failures", () => {
    it("a fetch failure adds the id to snapshot.failed and playSfx resolves without throwing", async () => {
      const { engine, fake } = await setup();
      fake.controls.failFetchUrls.add(DOOR.src);

      await expect(engine.playSfx(DOOR)).resolves.toBeUndefined();

      expect(engine.getSnapshot().failed).toEqual(["door"]);
      expect(fake.bufferSources).toHaveLength(0);
    });

    it("a decode failure adds the id to snapshot.failed and preloadSfx resolves without throwing", async () => {
      const { engine, fake } = await setup();
      fake.controls.failDecode = true;

      await expect(engine.preloadSfx([DOOR, SHOT])).resolves.toBeUndefined();

      expect(engine.getSnapshot().failed).toEqual(["door", "shot"]);
    });

    it("a failed sound is listed once and not retried within the session", async () => {
      const { engine, fake } = await setup();
      fake.controls.failFetchUrls.add(DOOR.src);

      await engine.playSfx(DOOR);
      await engine.playSfx(DOOR);
      await engine.preloadSfx([DOOR]);

      expect(fake.fetchedUrls).toEqual([DOOR.src]);
      expect(engine.getSnapshot().failed).toEqual(["door"]);
    });

    it("one failing sound does not stop the others in a preload from loading and playing", async () => {
      const { engine, fake } = await setup();
      fake.controls.failFetchUrls.add(DOOR.src);

      await engine.preloadSfx([DOOR, SHOT]);
      await engine.playSfx(SHOT);

      expect(engine.getSnapshot().failed).toEqual(["door"]);
      expect(fake.bufferSources).toHaveLength(1);
    });

    it("a source that fails to start does not reject playSfx or mark the sound failed", async () => {
      const { engine, fake } = await setup();
      const createSource = fake.context.createBufferSource.bind(fake.context);
      fake.context.createBufferSource = () => {
        const source = createSource();
        source.start = () => {
          throw new Error("InvalidStateError");
        };
        return source;
      };

      await expect(engine.playSfx(DOOR)).resolves.toBeUndefined();

      expect(engine.getSnapshot().failed).toEqual([]);
    });
  });

  describe("before the engine is unlocked", () => {
    it("playSfx and preloadSfx resolve without fetching, playing or throwing", async () => {
      const fake = createFakeDeps();
      const engine = new AudioEngine(fake.deps);

      await expect(engine.playSfx(DOOR)).resolves.toBeUndefined();
      await expect(engine.preloadSfx([DOOR])).resolves.toBeUndefined();

      expect(fake.fetchedUrls).toEqual([]);
      expect(fake.contexts).toHaveLength(0);
      expect(engine.getSnapshot().failed).toEqual([]);
    });

    it("playSfx does not play while the context is suspended after an unlock", async () => {
      const { engine, fake } = await setup();
      fake.context.setState("suspended");

      await engine.playSfx(DOOR);

      expect(fake.bufferSources).toHaveLength(0);
      expect(fake.fetchedUrls).toEqual([]);
    });
  });
});
