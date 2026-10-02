"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Adventure, Scene, SceneCue } from "@/adventures";
import type { Layer, TrackLayer } from "@/audio-engine";
import { getSound, type Sound } from "@/sound-library";
import { fireCue } from "./fire-cue";
import { Mixer } from "./mixer";
import { ScenePanel } from "./scene-panel";
import { SceneList } from "./scene-list";
import { FailureToasts } from "./toast";
import { TransportBar } from "./transport-bar";
import { UnlockOverlay } from "./unlock-overlay";
import { useAudioEngine } from "./use-audio-engine";
import { useWakeLock } from "./use-wake-lock";

/** Every sfx an adventure can fire, from scene grids and cues, deduplicated. */
function adventureSfx(adventure: Adventure): Sound[] {
  const ids = new Set<string>();
  for (const scene of adventure.scenes) {
    for (const id of scene.sfxIds) ids.add(id);
    for (const cue of scene.cues) for (const id of cue.soundIds) ids.add(id);
  }
  return [...ids]
    .map(getSound)
    .filter((sound): sound is Sound => sound?.kind === "sfx");
}

function sceneTrack(id: string | undefined): Sound | undefined {
  return id === undefined ? undefined : getSound(id);
}

export function Soundboard({ adventure }: { adventure: Adventure }) {
  const { engine, snapshot } = useAudioEngine();
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  // The tracks the GM last asked for (scene or cue). The engine drops
  // `setTrack` while locked, so they are re-applied on every unlock.
  const requestedTracks = useRef<Partial<Record<TrackLayer, Sound | undefined>>>({});
  const preloadList = useMemo(() => adventureSfx(adventure), [adventure]);
  const failed = useMemo(() => new Set(snapshot.failed), [snapshot.failed]);
  const activeScene = adventure.scenes.find((scene) => scene.id === activeSceneId);

  useWakeLock(true);

  useEffect(() => {
    if (!snapshot.unlocked) return;
    void engine.preloadSfx(preloadList);
    for (const [layer, sound] of Object.entries(requestedTracks.current)) {
      engine.setTrack(layer as TrackLayer, sound);
    }
  }, [snapshot.unlocked, engine, preloadList]);

  useEffect(() => () => engine.stopAll(), [engine]);

  const requestTrack = (layer: TrackLayer, sound: Sound | undefined) => {
    requestedTracks.current[layer] = sound;
    engine.setTrack(layer, sound);
  };

  const selectScene = (scene: Scene) => {
    setActiveSceneId(scene.id);
    requestTrack("music", sceneTrack(scene.musicId));
    requestTrack("ambience", sceneTrack(scene.ambienceId));
  };

  const handleCue = (cue: SceneCue) => {
    fireCue(engine, cue, getSound);
    for (const id of cue.soundIds) {
      const sound = getSound(id);
      if (sound && sound.kind !== "sfx") requestedTracks.current[sound.kind] = sound;
    }
  };

  const playSfx = (sound: Sound) => void engine.playSfx(sound);
  const setVolume = (layer: Layer, value: number) => engine.setVolume(layer, value);

  return (
    <>
      {/* While locked, the shell is inert: calls would be dropped by the engine. */}
      <div className="flex h-dvh flex-col" inert={!snapshot.unlocked}>
        <header className="flex items-center gap-4 border-b border-brass/30 px-4 py-2">
          <Link
            href="/"
            className="flex min-h-11 shrink-0 items-center text-sm text-mist hover:text-bone"
          >
            Partidas
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg text-brass-bright sm:text-2xl">
            {adventure.title}
          </h1>
          {/* Slot for the library drawer's "Biblioteca" button (Task 9). */}
          <div data-slot="biblioteca" className="flex shrink-0 items-center gap-2" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-kelp md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
            <SceneList
              scenes={adventure.scenes}
              activeSceneId={activeSceneId}
              onSelect={selectScene}
            />
          </aside>
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <ScenePanel
              scene={activeScene}
              current={snapshot.current}
              failed={failed}
              lookup={getSound}
              onFireCue={handleCue}
              onPlaySfx={playSfx}
            />
          </main>
        </div>

        <footer className="flex flex-col gap-3 border-t border-brass/30 bg-abyss px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex-row md:items-center md:gap-8">
          <Mixer volumes={snapshot.volumes} onChange={setVolume} />
          <TransportBar
            silenced={snapshot.silenced}
            onSilence={() => engine.silence()}
            onResume={() => engine.resume()}
            onStopSfx={() => engine.stopAllSfx()}
          />
        </footer>
      </div>

      <FailureToasts failed={snapshot.failed} lookup={getSound} />
      {!snapshot.unlocked && (
        <UnlockOverlay
          adventureTitle={adventure.title}
          onUnlock={() => void engine.unlock()}
        />
      )}
    </>
  );
}
