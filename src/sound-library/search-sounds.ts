import type { Sound, SoundKind } from "./types";

/** Lowercase and strip diacritics so "Crístal" and "cristal" compare equal. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Sounds whose title or tags contain every whitespace-separated term of
 * `query` (accent- and case-insensitive), optionally of one kind, sorted by
 * title in Spanish order. An empty query matches everything.
 */
export function searchSounds(
  sounds: Sound[],
  query: string,
  kind?: SoundKind,
): Sound[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return sounds
    .filter((sound) => kind === undefined || sound.kind === kind)
    .filter((sound) => {
      const haystack = [sound.title, ...sound.tags].map(normalize);
      return terms.every((term) => haystack.some((text) => text.includes(term)));
    })
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
}
