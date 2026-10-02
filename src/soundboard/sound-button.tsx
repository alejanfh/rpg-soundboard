import type { Sound } from "@/sound-library";

interface SoundButtonProps {
  sound: Sound;
  failed: boolean;
  /** Small secondary line under the title, e.g. the sound's kind. */
  caption?: string;
  onPlay: (sound: Sound) => void;
}

/** A large one-shot button. A sound that failed to load is shown disabled. */
export function SoundButton({ sound, failed, caption, onPlay }: SoundButtonProps) {
  return (
    <button
      type="button"
      disabled={failed}
      onClick={() => onPlay(sound)}
      className="flex min-h-16 w-full flex-col items-start justify-center rounded-md border border-kelp bg-tank px-3 py-2 text-left text-base leading-snug text-bone hover:border-verdigris active:bg-kelp disabled:cursor-not-allowed disabled:border-dashed disabled:border-coral/60 disabled:bg-transparent disabled:text-mist"
    >
      <span>{sound.title}</span>
      {caption && <span className="text-sm text-mist">{caption}</span>}
      {failed && <span className="text-sm text-coral">No disponible</span>}
    </button>
  );
}
