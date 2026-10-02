export type Layer = "music" | "ambience" | "sfx";
export type TrackLayer = "music" | "ambience";

export interface PlayableSound {
  id: string;
  src: string;
}

export interface EngineSnapshot {
  unlocked: boolean;
  silenced: boolean;
  /** Per-layer user volume, 0..1. */
  volumes: Record<Layer, number>;
  /** Ids of the sounds currently assigned to each track layer. */
  current: Partial<Record<TrackLayer, string>>;
  /** Ids of sounds that failed to load or decode. */
  failed: readonly string[];
}

export interface AudioEngineDeps {
  createContext: () => AudioContext;
  createMediaElement: () => HTMLAudioElement;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
}
