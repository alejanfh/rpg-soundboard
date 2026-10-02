import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine, CROSSFADE_SECONDS } from "./audio-engine";
import {
  asFakeGain,
  createFakeDeps,
  type FakeAudioNode,
  type FakeGainNode,
  type FakeMediaElement,
  type GainCall,
} from "./test-doubles";
import type { TrackLayer } from "./types";

const A = { id: "a", src: "/audio/a.mp3" };
const B = { id: "b", src: "/audio/b.mp3" };
const C = { id: "c", src: "/audio/c.mp3" };

type CurveCall = Extract<GainCall, { type: "setValueCurveAtTime" }>;

async function setup() {
  const fake = createFakeDeps();
  const engine = new AudioEngine(fake.deps);
  await engine.unlock();
  return { fake, engine };
}

interface Deck {
  element: FakeMediaElement;
  gain: FakeGainNode;
}

/** The decks wired into a layer's bus, in creation order. */
function decksOf(
  fake: ReturnType<typeof createFakeDeps>,
  engine: AudioEngine,
  layer: TrackLayer,
): Deck[] {
  const bus = engine.getGraph()?.buses[layer] as unknown as FakeAudioNode;
  return fake.context.mediaSources
    .map((source) => ({
      element: source.mediaElement,
      gain: source.connections[0] as FakeGainNode,
    }))
    .filter((deck) => deck.gain.connections.includes(bus));
}

function curves(gain: FakeGainNode): CurveCall[] {
  return gain.gain.calls.filter(
    (call): call is CurveCall => call.type === "setValueCurveAtTime",
  );
}

function lastCurve(gain: FakeGainNode): CurveCall {
  const last = curves(gain).at(-1);
  if (!last) throw new Error("No curve was scheduled");
  return last;
}

/** The setValueAtTime anchor scheduled right before the last curve. */
function anchorBeforeLastCurve(gain: FakeGainNode): GainCall | undefined {
  const calls = gain.gain.calls;
  const index = calls.lastIndexOf(lastCurve(gain));
  return calls[index - 1];
}

function playingElements(decks: Deck[]): FakeMediaElement[] {
  return decks.filter((deck) => !deck.element.paused).map((d) => d.element);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AudioEngine tracks", () => {
  it("setTrack starts a looping media element routed through a deck gain and ramps it in over CROSSFADE_SECONDS", async () => {
    const { engine, fake } = await setup();

    engine.setTrack("music", A);

    const decks = decksOf(fake, engine, "music");
    const playing = decks.filter((deck) => !deck.element.paused);
    expect(playing).toHaveLength(1);
    const [deck] = playing;
    expect(deck.element.src).toBe(A.src);
    expect(deck.element.loop).toBe(true);
    expect(deck.element.preload).toBe("auto");
    expect(deck.element.crossOrigin).toBe("anonymous");
    expect("volume" in deck.element).toBe(false);

    const curve = lastCurve(deck.gain);
    expect(curve.duration).toBe(CROSSFADE_SECONDS);
    expect(curve.values).toHaveLength(64);
    expect(curve.values[0]).toBeCloseTo(0);
    expect(curve.values.at(-1)).toBe(1);
    expect(deck.gain.gain.settledValue).toBe(1);
    expect(engine.getSnapshot().current).toEqual({ music: "a" });
  });

  it("switching track crossfades: incoming deck ramps 0→1, outgoing 1→0 with equal-power curves, and outgoing element is paused after the fade", async () => {
    const { engine, fake } = await setup();
    engine.setTrack("music", A);
    fake.context.currentTime = 10;
    const [first] = decksOf(fake, engine, "music").filter(
      (deck) => !deck.element.paused,
    );

    engine.setTrack("music", B);

    const decks = decksOf(fake, engine, "music");
    const incoming = decks.find((deck) => deck.element.src === B.src);
    expect(incoming).toBeDefined();
    expect(incoming).not.toBe(first);
    const inCurve = lastCurve(incoming!.gain);
    const outCurve = lastCurve(first.gain);
    expect(inCurve.time).toBe(10);
    expect(outCurve.time).toBe(10);
    expect(inCurve.duration).toBe(CROSSFADE_SECONDS);
    expect(outCurve.duration).toBe(CROSSFADE_SECONDS);
    expect(inCurve.values[0]).toBeCloseTo(0);
    expect(inCurve.values.at(-1)).toBe(1);
    expect(outCurve.values[0]).toBeCloseTo(1);
    expect(outCurve.values.at(-1)).toBe(0);
    inCurve.values.forEach((value, index) => {
      expect(value ** 2 + outCurve.values[index] ** 2).toBeCloseTo(1, 5);
    });
    expect(anchorBeforeLastCurve(incoming!.gain)).toMatchObject({
      type: "setValueAtTime",
      value: 0,
      time: 10,
    });
    expect(anchorBeforeLastCurve(first.gain)).toMatchObject({
      type: "setValueAtTime",
      value: 1,
      time: 10,
    });

    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000 - 1);
    expect(first.element.paused).toBe(false);
    vi.advanceTimersByTime(1);
    expect(first.element.paused).toBe(true);
    expect(incoming!.element.paused).toBe(false);
    expect(engine.getSnapshot().current).toEqual({ music: "b" });
  });

  it("setting the currently playing track is a no-op", async () => {
    const { engine, fake } = await setup();
    engine.setTrack("music", A);
    const snapshot = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);
    const decks = decksOf(fake, engine, "music");
    const callCounts = decks.map((deck) => deck.gain.gain.calls.length);
    const playCounts = decks.map((deck) => deck.element.playCalls);

    engine.setTrack("music", A);

    expect(listener).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toBe(snapshot);
    expect(decks.map((deck) => deck.gain.gain.calls.length)).toEqual(callCounts);
    expect(decks.map((deck) => deck.element.playCalls)).toEqual(playCounts);
  });

  it("setTrack(layer, undefined) fades the layer out and clears snapshot.current[layer]", async () => {
    const { engine, fake } = await setup();
    engine.setTrack("music", A);
    engine.setTrack("ambience", B);
    fake.context.currentTime = 20;
    const [music] = decksOf(fake, engine, "music").filter(
      (deck) => !deck.element.paused,
    );

    engine.setTrack("music", undefined);

    const curve = lastCurve(music.gain);
    expect(curve.time).toBe(20);
    expect(curve.duration).toBe(CROSSFADE_SECONDS);
    expect(curve.values[0]).toBeCloseTo(1);
    expect(curve.values.at(-1)).toBe(0);
    expect(music.element.paused).toBe(false);
    expect(engine.getSnapshot().current).toEqual({ ambience: "b" });

    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000);
    expect(music.element.paused).toBe(true);
    expect(playingElements(decksOf(fake, engine, "ambience"))).toHaveLength(1);
  });

  it("setTrack(layer, undefined) with nothing playing does not notify", async () => {
    const { engine } = await setup();
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.setTrack("music", undefined);

    expect(listener).not.toHaveBeenCalled();
  });

  it("rapid switching A→B→C within the crossfade window leaves only C at non-zero target gain and pauses A and B", async () => {
    const { engine, fake } = await setup();
    engine.setTrack("music", A);
    const [deckA] = decksOf(fake, engine, "music").filter(
      (deck) => !deck.element.paused,
    );
    fake.context.currentTime = 1;
    engine.setTrack("music", B);
    const deckB = decksOf(fake, engine, "music").find(
      (deck) => deck.element.src === B.src,
    )!;
    fake.context.currentTime = 2;

    engine.setTrack("music", C);

    // Only two decks exist: C reuses A's deck, which still had a pending pause.
    const decks = decksOf(fake, engine, "music");
    expect(decks).toHaveLength(2);
    const deckC = decks.find((deck) => deck.element.src === C.src)!;
    expect(deckC.element).toBe(deckA.element);
    expect(deckC.element.paused).toBe(false);
    // The reused deck continues from its mid-fade level (0.5 * cos(pi/6)), not from a jump.
    const anchor = anchorBeforeLastCurve(deckC.gain);
    expect(anchor).toMatchObject({ type: "setValueAtTime", time: 2 });
    expect((anchor as { value: number }).value).toBeCloseTo(
      0.5 * Math.cos(Math.PI / 6),
      5,
    );

    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000 * 2);

    expect(playingElements(decks)).toEqual([deckC.element]);
    expect(deckC.gain.gain.settledValue).toBe(1);
    expect(deckB.gain.gain.settledValue).toBe(0);
    expect(deckB.element.paused).toBe(true);
    expect(engine.getSnapshot().current).toEqual({ music: "c" });
  });

  it("a deck reused during its fade-out is not paused by the stale timer", async () => {
    const { engine, fake } = await setup();
    engine.setTrack("music", A);
    engine.setTrack("music", B);
    engine.setTrack("music", C);
    const deckC = decksOf(fake, engine, "music").find(
      (deck) => deck.element.src === C.src,
    )!;

    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000);

    expect(deckC.element.paused).toBe(false);
    expect(deckC.element.pauseCalls).toBe(0);
  });

  it("setTrack while silenced keeps master at 0", async () => {
    const { engine, fake } = await setup();
    engine.silence();
    const master = asFakeGain(engine.getGraph()!.master);
    const masterCalls = master.gain.calls.length;

    engine.setTrack("music", A);
    engine.setTrack("music", B);
    engine.setTrack("ambience", C);
    engine.setTrack("music", undefined);

    expect(master.gain.calls).toHaveLength(masterCalls);
    expect(master.gain.settledValue).toBe(0);
    expect(engine.getSnapshot().silenced).toBe(true);

    engine.resume();
    expect(master.gain.settledValue).toBe(1);
    expect(fake.context.mediaSources.length).toBeGreaterThan(0);
  });

  it("setTrack before unlock is a no-op", () => {
    const fake = createFakeDeps();
    const engine = new AudioEngine(fake.deps);

    engine.setTrack("music", A);

    expect(fake.mediaElements).toHaveLength(0);
    expect(engine.getSnapshot().current).toEqual({});
  });

  it("media element error adds the sound id to snapshot.failed without throwing", async () => {
    const { engine, fake } = await setup();
    engine.setTrack("music", A);
    const [deck] = decksOf(fake, engine, "music").filter(
      (d) => !d.element.paused,
    );

    expect(() => deck.element.emitError()).not.toThrow();
    deck.element.emitError();

    expect(engine.getSnapshot().failed).toEqual(["a"]);
    // The UI shows the error state for the current track, so it stays current.
    expect(engine.getSnapshot().current).toEqual({ music: "a" });
  });

  it("a rejected play() marks the sound as failed without throwing", async () => {
    const { engine, fake } = await setup();
    const createElement = fake.deps.createMediaElement;
    fake.deps.createMediaElement = () => {
      const element = createElement();
      (element as unknown as FakeMediaElement).playError = new Error("refused");
      return element;
    };

    engine.setTrack("music", B);
    await vi.advanceTimersByTimeAsync(0);

    expect(engine.getSnapshot().failed).toEqual(["b"]);
    expect(engine.getSnapshot().current).toEqual({ music: "b" });
  });

  it("stopAll clears both layers", async () => {
    const { engine, fake } = await setup();
    engine.setTrack("music", A);
    engine.setTrack("ambience", B);

    engine.stopAll();

    expect(engine.getSnapshot().current).toEqual({});
    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000);
    for (const layer of ["music", "ambience"] as const) {
      expect(playingElements(decksOf(fake, engine, layer))).toHaveLength(0);
    }
  });

  it("music and ambience use independent deck pairs routed to their own buses", async () => {
    const { engine, fake } = await setup();

    engine.setTrack("music", A);
    engine.setTrack("ambience", B);

    const music = decksOf(fake, engine, "music");
    const ambience = decksOf(fake, engine, "ambience");
    expect(music).toHaveLength(2);
    expect(ambience).toHaveLength(2);
    expect(playingElements(music).map((e) => e.src)).toEqual([A.src]);
    expect(playingElements(ambience).map((e) => e.src)).toEqual([B.src]);
  });
});
