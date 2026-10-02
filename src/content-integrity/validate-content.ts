import type { Adventure } from "@/adventures/types";
import type { Sound, SoundKind } from "@/sound-library/types";

const ALLOWED_LICENSES: ReadonlySet<string> = new Set([
  "CC0",
  "CC-BY-4.0",
  "public-domain",
  "generated",
]);

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * Checks the sound library and adventures against the integrity rules.
 * Returns human-readable error messages; an empty array means valid content.
 * `fileExists` receives the public path of an audio file (e.g. `/audio/sfx/x.mp3`).
 */
export function validateContent(
  sounds: Sound[],
  adventures: Adventure[],
  fileExists: (publicPath: string) => boolean,
): string[] {
  const errors: string[] = [];
  const soundsById = new Map(sounds.map((sound) => [sound.id, sound]));

  for (const id of findDuplicates(sounds.map((sound) => sound.id))) {
    errors.push(`Duplicate sound id "${id}"`);
  }
  for (const id of findDuplicates(adventures.map((adventure) => adventure.id))) {
    errors.push(`Duplicate adventure id "${id}"`);
  }

  for (const sound of sounds) {
    if (!fileExists(sound.src)) {
      errors.push(`Sound "${sound.id}": audio file not found at "${sound.src}"`);
    }
    const { credit } = sound;
    if (!credit) {
      errors.push(`Sound "${sound.id}": missing credit`);
      continue;
    }
    if (credit.source !== "generated" && !credit.url) {
      errors.push(
        `Sound "${sound.id}": credit with source "${credit.source}" requires a url`,
      );
    }
    if (!ALLOWED_LICENSES.has(credit.license)) {
      errors.push(
        `Sound "${sound.id}": license "${credit.license}" is not in the allowed set (${[...ALLOWED_LICENSES].join(", ")})`,
      );
    }
    if (credit.license === "CC-BY-4.0" && !credit.workTitle) {
      errors.push(
        `Sound "${sound.id}": CC-BY-4.0 credit requires a workTitle (the original work's title)`,
      );
    }
  }

  for (const adventure of adventures) {
    for (const sceneId of findDuplicates(adventure.scenes.map((scene) => scene.id))) {
      errors.push(`Adventure "${adventure.id}": duplicate scene id "${sceneId}"`);
    }

    for (const scene of adventure.scenes) {
      const where = `Adventure "${adventure.id}", scene "${scene.id}"`;

      const checkSlot = (slot: string, soundId: string, kind: SoundKind) => {
        const sound = soundsById.get(soundId);
        if (!sound) {
          errors.push(`${where}: ${slot} references unknown sound "${soundId}"`);
        } else if (sound.kind !== kind) {
          errors.push(
            `${where}: ${slot} sound "${soundId}" must be of kind "${kind}" but is "${sound.kind}"`,
          );
        }
      };

      if (scene.musicId !== undefined) checkSlot("musicId", scene.musicId, "music");
      if (scene.ambienceId !== undefined) {
        checkSlot("ambienceId", scene.ambienceId, "ambience");
      }
      for (const soundId of scene.sfxIds) checkSlot("sfxIds", soundId, "sfx");

      for (const cue of scene.cues) {
        for (const soundId of cue.soundIds) {
          if (!soundsById.has(soundId)) {
            errors.push(
              `${where}: cue "${cue.moment}" references unknown sound "${soundId}"`,
            );
          }
        }
      }
    }
  }

  return errors;
}
