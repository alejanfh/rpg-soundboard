// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sounds } from "@/sound-library";

interface ManifestEntry {
  id: string;
  kind: string;
  source: string;
  author: string;
  license: string;
  pageUrl?: string;
  sourceTitle?: string;
}

const manifest: ManifestEntry[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "audio-sources.json"), "utf8"),
);

const soundsById = new Map(sounds.map((sound) => [sound.id, sound]));

describe("audio manifest and sound library", () => {
  it("describe the same set of sounds", () => {
    expect(manifest.map((entry) => entry.id).sort()).toEqual(
      sounds.map((sound) => sound.id).sort(),
    );
  });

  it.each(manifest.map((entry) => [entry.id, entry] as const))(
    "%s agrees on kind, source, author, license, url and work title",
    (_id, entry) => {
      const sound = soundsById.get(entry.id);
      expect(sound).toBeDefined();
      expect(sound!.kind).toBe(entry.kind);
      expect(sound!.credit.source).toBe(entry.source);
      expect(sound!.credit.author).toBe(entry.author);
      expect(sound!.credit.license).toBe(entry.license);
      if (entry.pageUrl !== undefined) expect(sound!.credit.url).toBe(entry.pageUrl);
      if (entry.license === "CC-BY-4.0") {
        expect(sound!.credit.workTitle).toBe(entry.sourceTitle);
      }
    },
  );
});
