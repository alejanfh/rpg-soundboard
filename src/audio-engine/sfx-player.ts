import type { PlayableSound } from "./types";

export interface SfxPlayerOptions {
  context: AudioContext;
  /** The sfx bus every source routes into. */
  bus: GainNode;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  /** Called once per sound whose file could not be fetched or decoded. */
  onFailed: (soundId: string) => void;
}

/**
 * Polyphonic one-shot playback of decoded buffers. Buffers are cached by
 * sound id, concurrent loads of one id share a single in-flight promise, and a
 * sound that failed to load is not retried for the lifetime of the player.
 * Nothing here rejects: failures are reported through `onFailed`.
 */
export class SfxPlayer {
  private readonly options: SfxPlayerOptions;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
  private readonly failed = new Set<string>();
  private readonly active = new Set<AudioBufferSourceNode>();
  /** Bumped by `stopAll` so presses that were still loading do not fire late. */
  private generation = 0;

  constructor(options: SfxPlayerOptions) {
    this.options = options;
  }

  async preload(sounds: readonly PlayableSound[]): Promise<void> {
    await Promise.all(sounds.map((sound) => this.load(sound)));
  }

  /** Starts `sound`; a cached buffer starts synchronously, before the promise settles. */
  play(sound: PlayableSound): Promise<void> {
    const cached = this.buffers.get(sound.id);
    if (cached) {
      this.start(cached);
      return Promise.resolve();
    }
    return this.playAfterLoad(sound);
  }

  stopAll(): void {
    this.generation += 1;
    for (const source of [...this.active]) {
      try {
        source.stop();
      } catch {
        // Already stopped or never started: nothing left to silence.
      }
    }
    this.active.clear();
  }

  private async playAfterLoad(sound: PlayableSound): Promise<void> {
    const generation = this.generation;
    const buffer = await this.load(sound);
    if (buffer && generation === this.generation) this.start(buffer);
  }

  private load(sound: PlayableSound): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(sound.id);
    if (cached) return Promise.resolve(cached);
    if (this.failed.has(sound.id)) return Promise.resolve(null);
    const inFlight = this.loading.get(sound.id);
    if (inFlight) return inFlight;

    const request = this.fetchAndDecode(sound).finally(() => {
      this.loading.delete(sound.id);
    });
    this.loading.set(sound.id, request);
    return request;
  }

  private async fetchAndDecode(sound: PlayableSound): Promise<AudioBuffer | null> {
    try {
      const data = await this.options.fetchArrayBuffer(sound.src);
      const buffer = await this.options.context.decodeAudioData(data);
      this.buffers.set(sound.id, buffer);
      return buffer;
    } catch {
      this.failed.add(sound.id);
      this.options.onFailed(sound.id);
      return null;
    }
  }

  private start(buffer: AudioBuffer): void {
    const { context, bus } = this.options;
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(bus);
      source.onended = () => {
        this.active.delete(source);
        try {
          source.disconnect();
        } catch {
          // Already disconnected.
        }
      };
      source.start();
      this.active.add(source);
    } catch {
      // A context that refuses to start a source is not a broken file; this
      // press is lost but playSfx must still never reject.
    }
  }
}
