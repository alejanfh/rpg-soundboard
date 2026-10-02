import { describe, expect, it } from "vitest";
import type { Adventure } from "@/adventures/types";
import type { Sound, SoundKind } from "@/sound-library/types";
import { validateContent } from "./validate-content";

const sound = (id: string, kind: SoundKind, overrides: Partial<Sound> = {}): Sound => ({
  id,
  title: id,
  kind,
  src: `/audio/${kind}/${id}.mp3`,
  tags: [],
  credit: {
    author: "Autor",
    source: "freesound",
    license: "CC0",
    url: "https://example.com",
  },
  ...overrides,
});

const adventure = (
  scene: Partial<Adventure["scenes"][number]> = {},
  id = "aventura",
): Adventure => ({
  id,
  title: id,
  system: "el-rastro-de-cthulhu",
  synopsis: "",
  scenes: [{ id: "escena", title: "Escena", sfxIds: [], cues: [], ...scene }],
});

const validSounds = [
  sound("tema", "music"),
  sound("lluvia", "ambience"),
  sound("trueno", "sfx"),
];
const exists = () => true;

describe("validateContent", () => {
  it("returns empty array for valid content", () => {
    const adventures = [
      adventure({
        musicId: "tema",
        ambienceId: "lluvia",
        sfxIds: ["trueno"],
        cues: [{ moment: "Momento", soundIds: ["trueno"] }],
      }),
    ];
    expect(validateContent(validSounds, adventures, exists)).toEqual([]);
  });

  it("reports unknown sound id referenced by a scene", () => {
    const errors = validateContent(
      validSounds,
      [adventure({ musicId: "fantasma" })],
      exists,
    );
    expect(errors.join("\n")).toContain("fantasma");
  });

  it("reports unknown sound id referenced by a cue", () => {
    const errors = validateContent(
      validSounds,
      [adventure({ cues: [{ moment: "m", soundIds: ["fantasma"] }] })],
      exists,
    );
    expect(errors.join("\n")).toContain("fantasma");
  });

  it("reports music slot pointing to a non-music sound", () => {
    const errors = validateContent(validSounds, [adventure({ musicId: "trueno" })], exists);
    expect(errors.join("\n")).toContain("trueno");
  });

  it("reports ambience slot pointing to a non-ambience sound", () => {
    const errors = validateContent(validSounds, [adventure({ ambienceId: "tema" })], exists);
    expect(errors.join("\n")).toContain("tema");
  });

  it("reports sfx slot pointing to a non-sfx sound", () => {
    const errors = validateContent(validSounds, [adventure({ sfxIds: ["lluvia"] })], exists);
    expect(errors.join("\n")).toContain("lluvia");
  });

  it("accepts cue sounds of any kind", () => {
    const adventures = [
      adventure({ cues: [{ moment: "m", soundIds: ["tema", "lluvia", "trueno"] }] }),
    ];
    expect(validateContent(validSounds, adventures, exists)).toEqual([]);
  });

  it("reports duplicate sound ids", () => {
    const errors = validateContent(
      [...validSounds, sound("trueno", "sfx")],
      [],
      exists,
    );
    expect(errors.join("\n")).toContain("trueno");
  });

  it("reports duplicate adventure ids", () => {
    const errors = validateContent(
      validSounds,
      [adventure({}, "repetida"), adventure({}, "repetida")],
      exists,
    );
    expect(errors.join("\n")).toContain("repetida");
  });

  it("reports duplicate scene ids within an adventure", () => {
    const base = adventure();
    const dup: Adventure = {
      ...base,
      scenes: [...base.scenes, { ...base.scenes[0] }],
    };
    const errors = validateContent(validSounds, [dup], exists);
    expect(errors.join("\n")).toContain("escena");
  });

  it("reports missing audio file", () => {
    const errors = validateContent(validSounds, [], (p) => p !== "/audio/sfx/trueno.mp3");
    expect(errors.join("\n")).toContain("trueno");
    expect(errors).toHaveLength(1);
  });

  it("reports non-generated credit without url", () => {
    const noUrl = sound("sin-url", "sfx", {
      credit: { author: "A", source: "freesound", license: "CC0" },
    });
    const errors = validateContent([noUrl], [], exists);
    expect(errors.join("\n")).toContain("sin-url");
  });

  it("accepts generated credit without url", () => {
    const generated = sound("generado", "sfx", {
      credit: { author: "A", source: "generated", license: "generated" },
    });
    expect(validateContent([generated], [], exists)).toEqual([]);
  });

  it("reports license outside the allowed set", () => {
    const bad = sound("licencia-mala", "sfx", {
      credit: {
        author: "A",
        source: "freesound",
        license: "GPL" as never,
        url: "https://example.com",
      },
    });
    const errors = validateContent([bad], [], exists);
    expect(errors.join("\n")).toContain("licencia-mala");
  });

  it("reports the adventure and scene in scene errors", () => {
    const errors = validateContent(
      validSounds,
      [adventure({ musicId: "fantasma" }, "mi-aventura")],
      exists,
    );
    expect(errors.join("\n")).toContain("mi-aventura");
    expect(errors.join("\n")).toContain("escena");
  });
});
