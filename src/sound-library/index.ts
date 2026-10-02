import { sounds } from "./sounds";
import type { Sound, SoundKind } from "./types";

export { sounds };
export type { Sound, SoundCredit, SoundKind } from "./types";

export function getSound(id: string): Sound | undefined {
  return sounds.find((sound) => sound.id === id);
}

export function soundSrc(kind: SoundKind, id: string): string {
  return `/audio/${kind}/${id}.mp3`;
}
