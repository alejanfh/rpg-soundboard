import type { PlayableSound } from "./types";

/** Length of a crossfade, and of a fade to silence when a track stops. */
export const CROSSFADE_SECONDS = 3;

const CURVE_SAMPLES = 64;

/** Tracked locally: gain params report stale values mid-automation on some browsers. */
interface Fade {
  from: number;
  to: 0 | 1;
  start: number;
}

interface Deck {
  element: HTMLAudioElement;
  gain: GainNode;
  soundId: string | undefined;
  fade: Fade | null;
  pauseTimer: ReturnType<typeof setTimeout> | undefined;
}

export interface TrackChannelOptions {
  context: AudioContext;
  /** The layer bus the decks route into. */
  bus: GainNode;
  createMediaElement: () => HTMLAudioElement;
  /** Called when a sound's media element errors or refuses to play. */
  onFailed: (soundId: string) => void;
}

function errorName(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? (error as { name?: unknown }).name
    : undefined;
}

/** Equal-power curve from `from` to `to`: sine fade-in, cosine fade-out. */
function fadeCurve(from: number, to: 0 | 1): Float32Array {
  const values = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const angle = (i / (CURVE_SAMPLES - 1)) * (Math.PI / 2);
    values[i] = to === 1 ? from + (1 - from) * Math.sin(angle) : from * Math.cos(angle);
  }
  values[CURVE_SAMPLES - 1] = to;
  return values;
}

/**
 * One track layer: two decks (media element -> gain -> layer bus) that
 * crossfade into each other. Only one deck is "active" at a time; the other
 * is either idle or fading out with a pending pause.
 */
export class TrackChannel {
  private readonly options: TrackChannelOptions;
  private readonly decks: [Deck, Deck];
  private active: Deck | null = null;

  constructor(options: TrackChannelOptions) {
    this.options = options;
    this.decks = [this.createDeck(), this.createDeck()];
  }

  get currentId(): string | undefined {
    return this.active?.soundId;
  }

  /** Crossfades to `sound`. Returns false when it is already the current track. */
  play(sound: PlayableSound): boolean {
    if (this.active?.soundId === sound.id) return false;
    const outgoing = this.active;
    const incoming = this.decks[0] === outgoing ? this.decks[1] : this.decks[0];

    // A->B->A: the idle deck may still hold this sound (maybe still playing,
    // still fading out). Keep its source and fade it back up instead of
    // reloading it.
    const holdsSound = incoming.soundId === sound.id;
    clearTimeout(incoming.pauseTimer);
    incoming.pauseTimer = undefined;
    incoming.soundId = sound.id;
    if (!holdsSound) incoming.element.src = sound.src;
    this.fade(incoming, 1);
    if (!holdsSound || incoming.element.paused) this.start(incoming, sound.id);

    if (outgoing) this.fadeOut(outgoing);
    this.active = incoming;
    return true;
  }

  /** Fades the layer out. Returns false when nothing was playing. */
  stop(): boolean {
    if (!this.active) return false;
    this.fadeOut(this.active);
    this.active = null;
    return true;
  }

  private createDeck(): Deck {
    const { context, bus, createMediaElement, onFailed } = this.options;
    const element = createMediaElement();
    element.crossOrigin = "anonymous";
    element.loop = true;
    element.preload = "auto";

    const gain = context.createGain();
    gain.gain.value = 0;
    context.createMediaElementSource(element).connect(gain);
    gain.connect(bus);

    const deck: Deck = {
      element,
      gain,
      soundId: undefined,
      fade: null,
      pauseTimer: undefined,
    };
    element.addEventListener("error", () => {
      if (deck.soundId !== undefined) onFailed(deck.soundId);
    });
    return deck;
  }

  private start(deck: Deck, soundId: string): void {
    const onRejected = (error: unknown) => {
      // AbortError: a pause() or new src interrupted play(), normal while switching.
      // NotAllowedError: autoplay/gesture policy, not a broken file.
      const name = errorName(error);
      if (name === "AbortError" || name === "NotAllowedError") return;
      if (deck.soundId === soundId) this.options.onFailed(soundId);
    };
    try {
      Promise.resolve(deck.element.play()).catch(onRejected);
    } catch (error) {
      onRejected(error);
    }
  }

  private fadeOut(deck: Deck): void {
    this.fade(deck, 0);
    deck.pauseTimer = setTimeout(() => {
      deck.pauseTimer = undefined;
      deck.element.pause();
    }, CROSSFADE_SECONDS * 1000);
  }

  /** Where the deck's gain is right now, following its last scheduled fade. */
  private levelAt(deck: Deck, now: number): number {
    const { fade } = deck;
    if (!fade) return 0;
    const progress = (now - fade.start) / CROSSFADE_SECONDS;
    if (progress >= 1) return fade.to;
    const angle = Math.max(0, progress) * (Math.PI / 2);
    return fade.to === 1
      ? fade.from + (1 - fade.from) * Math.sin(angle)
      : fade.from * Math.cos(angle);
  }

  /**
   * Schedules an equal-power fade. Web Audio param calls can throw (for
   * example when a curve overlaps another event); a failed fade must never
   * escape or leave the deck half-changed, so it degrades to a hard cut to
   * the target gain.
   */
  private fade(deck: Deck, to: 0 | 1): void {
    const now = this.options.context.currentTime;
    const from = this.levelAt(deck, now);
    const { gain } = deck.gain;
    try {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(from, now);
      gain.setValueCurveAtTime(fadeCurve(from, to), now, CROSSFADE_SECONDS);
      deck.fade = { from, to, start: now };
    } catch {
      try {
        gain.cancelScheduledValues(now);
      } catch {
        // Best effort: the direct assignment below still applies.
      }
      gain.value = to;
      deck.fade = { from: to, to, start: now };
    }
  }
}
