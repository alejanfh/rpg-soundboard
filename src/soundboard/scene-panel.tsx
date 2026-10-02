import type { Scene, SceneCue } from "@/adventures";
import type { EngineSnapshot } from "@/audio-engine";
import type { Sound } from "@/sound-library";
import { SoundButton } from "./sound-button";

interface ScenePanelProps {
  scene: Scene | undefined;
  current: EngineSnapshot["current"];
  failed: ReadonlySet<string>;
  lookup: (id: string) => Sound | undefined;
  onFireCue: (cue: SceneCue) => void;
  onPlaySfx: (sound: Sound) => void;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/** The active scene's cheat sheet (cue buttons) above its SFX grid. */
export function ScenePanel({
  scene,
  current,
  failed,
  lookup,
  onFireCue,
  onPlaySfx,
}: ScenePanelProps) {
  if (!scene) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center">
        <p className="text-xl text-mist">Elige una escena para empezar</p>
      </div>
    );
  }

  const music = current.music ? lookup(current.music) : undefined;
  const ambience = current.ambience ? lookup(current.ambience) : undefined;
  const sfx = scene.sfxIds.map(lookup).filter(isDefined);

  return (
    <article className="mx-auto max-w-4xl">
      <header className="border-b border-brass/30 pb-4">
        <h2 className="font-display text-3xl leading-tight text-bone sm:text-4xl">
          {scene.title}
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-verdigris">Música</dt>
          <dd className="text-mist">{music?.title ?? "Sin música"}</dd>
          <dt className="text-verdigris">Ambiente</dt>
          <dd className="text-mist">{ambience?.title ?? "Sin ambiente"}</dd>
        </dl>
      </header>

      {scene.cues.length > 0 && (
        <section aria-labelledby="cues-heading" className="mt-6">
          <h3 id="cues-heading" className="mb-2 text-sm font-medium text-verdigris">
            Momentos clave
          </h3>
          <ul className="grid gap-2">
            {scene.cues.map((cue) => (
              <li key={cue.moment}>
                <button
                  type="button"
                  onClick={() => onFireCue(cue)}
                  className="flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-md border border-l-4 border-kelp border-l-brass bg-tank/80 px-4 py-3 text-left hover:border-verdigris hover:border-l-brass-bright active:bg-kelp"
                >
                  <span className="text-lg leading-snug text-bone">{cue.moment}</span>
                  <span className="text-sm text-mist">
                    {cue.soundIds
                      .map((id) => lookup(id)?.title)
                      .filter(isDefined)
                      .join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sfx.length > 0 && (
        <section aria-labelledby="sfx-heading" className="mt-6">
          <h3 id="sfx-heading" className="mb-2 text-sm font-medium text-verdigris">
            Efectos
          </h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {sfx.map((sound) => (
              <li key={sound.id}>
                <SoundButton
                  sound={sound}
                  failed={failed.has(sound.id)}
                  onPlay={onPlaySfx}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
