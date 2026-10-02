import { sounds } from "./sounds";
import type { Sound } from "./types";

export { soundSrc } from "./paths";
export { searchSounds } from "./search-sounds";
export { sounds };
export type { Sound, SoundCredit, SoundKind } from "./types";

export function getSound(id: string): Sound | undefined {
  return sounds.find((sound) => sound.id === id);
}
