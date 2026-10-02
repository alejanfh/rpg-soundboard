import type { SceneCue } from "@/adventures";
import type { AudioEngine } from "@/audio-engine";
import type { Sound } from "@/sound-library";

/**
 * Fires every sound of a cue: sfx play as one-shots, music and ambience
 * replace their layer. Unknown ids are skipped.
 */
export function fireCue(
  engine: AudioEngine,
  cue: SceneCue,
  lookup: (id: string) => Sound | undefined,
): void {
  for (const id of cue.soundIds) {
    const sound = lookup(id);
    if (!sound) continue;
    if (sound.kind === "sfx") void engine.playSfx(sound);
    else engine.setTrack(sound.kind, sound);
  }
}
