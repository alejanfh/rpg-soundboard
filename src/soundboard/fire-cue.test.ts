import { describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "@/audio-engine";
import type { Sound, SoundKind } from "@/sound-library";
import { fireCue } from "./fire-cue";

function sound(id: string, kind: SoundKind): Sound {
  return {
    id,
    title: id,
    kind,
    src: `/audio/${kind}/${id}.mp3`,
    tags: [],
    credit: { author: "Test", source: "generated", license: "generated" },
  };
}

const library = [
  sound("grito", "sfx"),
  sound("cristal", "sfx"),
  sound("combate", "music"),
  sound("costa", "ambience"),
];

function lookup(id: string): Sound | undefined {
  return library.find((candidate) => candidate.id === id);
}

function fakeEngine() {
  const engine = {
    playSfx: vi.fn(() => Promise.resolve()),
    setTrack: vi.fn(),
  };
  return { engine, asEngine: engine as unknown as AudioEngine };
}

describe("fireCue", () => {
  it("fires sfx via playSfx", () => {
    const { engine, asEngine } = fakeEngine();

    fireCue(asEngine, { moment: "Grito", soundIds: ["cristal", "grito"] }, lookup);

    expect(engine.playSfx).toHaveBeenCalledTimes(2);
    expect(engine.playSfx).toHaveBeenNthCalledWith(1, lookup("cristal"));
    expect(engine.playSfx).toHaveBeenNthCalledWith(2, lookup("grito"));
    expect(engine.setTrack).not.toHaveBeenCalled();
  });

  it("switches music and ambience via setTrack", () => {
    const { engine, asEngine } = fakeEngine();

    fireCue(asEngine, { moment: "Salen", soundIds: ["combate", "costa"] }, lookup);

    expect(engine.setTrack).toHaveBeenCalledWith("music", lookup("combate"));
    expect(engine.setTrack).toHaveBeenCalledWith("ambience", lookup("costa"));
    expect(engine.playSfx).not.toHaveBeenCalled();
  });

  it("skips unknown ids", () => {
    const { engine, asEngine } = fakeEngine();

    expect(() =>
      fireCue(asEngine, { moment: "Mixto", soundIds: ["nope", "grito"] }, lookup),
    ).not.toThrow();

    expect(engine.playSfx).toHaveBeenCalledTimes(1);
    expect(engine.playSfx).toHaveBeenCalledWith(lookup("grito"));
    expect(engine.setTrack).not.toHaveBeenCalled();
  });
});
