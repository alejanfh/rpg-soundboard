export type SoundKind = "music" | "ambience" | "sfx";

export interface SoundCredit {
  author: string;
  source:
    | "freesound"
    | "incompetech"
    | "internet-archive"
    | "opengameart"
    | "generated";
  license: "CC0" | "CC-BY-4.0" | "public-domain" | "generated";
  /** Required unless source is 'generated'. */
  url?: string;
  /** Title of the original work, needed for CC-BY attribution. */
  workTitle?: string;
}

export interface Sound {
  /** kebab-case, unique, stable */
  id: string;
  /** Spanish, shown on buttons */
  title: string;
  kind: SoundKind;
  /** Path under /audio */
  src: string;
  /** Spanish search terms */
  tags: string[];
  credit: SoundCredit;
}
