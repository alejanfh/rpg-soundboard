import type { SoundKind } from "./types";

export function soundSrc(kind: SoundKind, id: string): string {
  return `/audio/${kind}/${id}.mp3`;
}
