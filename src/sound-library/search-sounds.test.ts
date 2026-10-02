import { describe, expect, it } from "vitest";
import { searchSounds } from "./search-sounds";
import { sounds } from "./sounds";

const ids = (list: { id: string }[]) => list.map((sound) => sound.id);

describe("searchSounds", () => {
  it("matches title case- and accent-insensitively", () => {
    // Title is "Cristal que estalla": no accent in it, so the query's accent
    // must be stripped too, and case must not matter.
    expect(ids(searchSounds(sounds, "CRISTAL"))).toContain("cristal-estalla");
    expect(ids(searchSounds(sounds, "crístal"))).toContain("cristal-estalla");
    // And the other way round: an accented title matches an unaccented query.
    expect(ids(searchSounds(sounds, "elegancia inquietante"))).toContain(
      "elegancia-inquietante",
    );
    expect(ids(searchSounds(sounds, "MISTERIO E INVESTIGACION"))).toContain(
      "misterio-investigacion",
    );
  });

  it("matches tags", () => {
    // "vidrio" is a tag of cristal-estalla and is not part of its title.
    expect(ids(searchSounds(sounds, "vidrio"))).toContain("cristal-estalla");
    expect(ids(searchSounds(sounds, "AÑOS 20"))).toContain("radio-epoca");
  });

  it("requires all terms", () => {
    expect(ids(searchSounds(sounds, "cristal vidrio"))).toContain("cristal-estalla");
    expect(ids(searchSounds(sounds, "cristal radio"))).toEqual([]);
    expect(ids(searchSounds(sounds, "  cristal   estalla "))).toContain("cristal-estalla");
  });

  it("filters by kind", () => {
    const music = searchSounds(sounds, "", "music");
    expect(music.length).toBeGreaterThan(0);
    expect(music.every((sound) => sound.kind === "music")).toBe(true);
    expect(ids(searchSounds(sounds, "cristal", "music"))).toEqual([]);
    expect(ids(searchSounds(sounds, "cristal", "sfx"))).toContain("cristal-estalla");
  });

  it("empty query returns all sorted", () => {
    const before = ids(sounds);
    const all = searchSounds(sounds, "   ");
    expect(all).toHaveLength(sounds.length);
    const titles = all.map((sound) => sound.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "es")));
    // Input is not mutated.
    expect(ids(sounds)).toEqual(before);
  });
});
