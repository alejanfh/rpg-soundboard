import type {
  AudioEngineDeps,
  EngineSnapshot,
  Layer,
} from "./types";

export const CROSSFADE_SECONDS = 3;
export const SILENCE_FADE_SECONDS = 0.4;
export const DEFAULT_VOLUMES: Readonly<Record<Layer, number>> = {
  music: 0.6,
  ambience: 0.5,
  sfx: 0.8,
};
export const VOLUMES_STORAGE_KEY = "rpg-soundboard:volumes";

const LAYERS: readonly Layer[] = ["music", "ambience", "sfx"];

/** The Web Audio graph: bus gains -> master gain -> destination. */
export interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  buses: Record<Layer, GainNode>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isValidVolume(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
  );
}

function loadVolumes(storage: AudioEngineDeps["storage"]): Record<Layer, number> {
  const volumes = { ...DEFAULT_VOLUMES };
  try {
    const raw = storage?.getItem(VOLUMES_STORAGE_KEY);
    if (!raw) return volumes;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return volumes;
    }
    for (const layer of LAYERS) {
      const value = (parsed as Record<string, unknown>)[layer];
      if (isValidVolume(value)) volumes[layer] = value;
    }
  } catch {
    // Unavailable storage or corrupt JSON: keep the defaults.
  }
  return volumes;
}

export class AudioEngine {
  private readonly deps: AudioEngineDeps;
  private readonly listeners = new Set<() => void>();
  private graph: AudioGraph | null = null;
  private snapshot: EngineSnapshot;

  constructor(deps: AudioEngineDeps) {
    this.deps = deps;
    this.snapshot = {
      unlocked: false,
      silenced: false,
      volumes: loadVolumes(deps.storage),
      current: {},
      failed: [],
    };
  }

  getSnapshot = (): EngineSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * The audio graph, or `null` until the first `unlock()` creates it.
   * Track decks and SFX sources route into `buses[layer]`.
   */
  getGraph(): AudioGraph | null {
    return this.graph;
  }

  /**
   * Merges `patch` into the snapshot and notifies subscribers.
   * Used by the engine's own features; not meant for UI code.
   * @internal
   */
  patchSnapshot(patch: Partial<EngineSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  /**
   * Creates the context and graph on first call and resumes the context.
   * Must run inside a user gesture. Never rejects: if the browser refuses,
   * the engine simply stays locked.
   */
  async unlock(): Promise<void> {
    const graph = this.graph ?? this.createGraph();
    try {
      await graph.context.resume();
    } catch {
      return;
    }
    this.syncUnlocked();
  }

  setVolume(layer: Layer, value: number): void {
    if (!Number.isFinite(value)) return;
    const next = clamp01(value);
    if (next === this.snapshot.volumes[layer]) return;
    const volumes = { ...this.snapshot.volumes, [layer]: next };
    if (this.graph) this.graph.buses[layer].gain.value = next;
    this.persistVolumes(volumes);
    this.patchSnapshot({ volumes });
  }

  /** Fades the master gain to 0. Bus volumes are untouched. */
  silence(): void {
    if (!this.graph || this.snapshot.silenced) return;
    this.rampMaster(this.graph, 0);
    this.patchSnapshot({ silenced: true });
  }

  /** Fades the master gain back to 1. */
  resume(): void {
    if (!this.graph || !this.snapshot.silenced) return;
    this.rampMaster(this.graph, 1);
    this.patchSnapshot({ silenced: false });
  }

  private createGraph(): AudioGraph {
    const context = this.deps.createContext();
    const master = context.createGain();
    master.gain.value = 1;
    master.connect(context.destination);

    const bus = (layer: Layer): GainNode => {
      const node = context.createGain();
      node.gain.value = this.snapshot.volumes[layer];
      node.connect(master);
      return node;
    };
    const graph: AudioGraph = {
      context,
      master,
      buses: { music: bus("music"), ambience: bus("ambience"), sfx: bus("sfx") },
    };

    context.onstatechange = () => this.syncUnlocked();
    this.graph = graph;
    return graph;
  }

  private syncUnlocked(): void {
    const unlocked = this.graph?.context.state === "running";
    if (unlocked !== this.snapshot.unlocked) this.patchSnapshot({ unlocked });
  }

  private rampMaster(graph: AudioGraph, target: number): void {
    const { gain } = graph.master;
    const now = graph.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(target, now + SILENCE_FADE_SECONDS);
  }

  private persistVolumes(volumes: Record<Layer, number>): void {
    try {
      this.deps.storage?.setItem(VOLUMES_STORAGE_KEY, JSON.stringify(volumes));
    } catch {
      // Volumes still apply for this session if storage is unavailable.
    }
  }
}
