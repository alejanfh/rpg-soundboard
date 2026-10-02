import type { AudioEngineDeps } from "./types";

/**
 * Small, honest fakes of the Web Audio / media element surface the engine uses.
 * `createFakeDeps()` wires them into an `AudioEngineDeps` plus inspection handles.
 */

export type GainCall =
  | { type: "setValueAtTime"; value: number; time: number }
  | { type: "linearRampToValueAtTime"; value: number; time: number }
  | {
      type: "setValueCurveAtTime";
      values: readonly number[];
      time: number;
      duration: number;
    }
  | { type: "cancelScheduledValues"; time: number };

export class FakeAudioParam {
  value: number;
  readonly calls: GainCall[] = [];

  constructor(value: number) {
    this.value = value;
  }

  setValueAtTime(value: number, time: number) {
    this.calls.push({ type: "setValueAtTime", value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push({ type: "linearRampToValueAtTime", value, time });
    return this;
  }

  setValueCurveAtTime(
    values: ArrayLike<number>,
    time: number,
    duration: number,
  ) {
    this.calls.push({
      type: "setValueCurveAtTime",
      values: Array.from(values),
      time,
      duration,
    });
    return this;
  }

  cancelScheduledValues(time: number) {
    this.calls.push({ type: "cancelScheduledValues", time });
    return this;
  }

  /** Value the param settles on once every scheduled automation has run. */
  get settledValue(): number {
    let result = this.value;
    for (const call of this.calls) {
      if (
        call.type === "setValueAtTime" ||
        call.type === "linearRampToValueAtTime"
      ) {
        result = call.value;
      } else if (call.type === "setValueCurveAtTime") {
        result = call.values[call.values.length - 1] ?? result;
      }
    }
    return result;
  }
}

export class FakeAudioNode {
  readonly connections: FakeAudioNode[] = [];

  connect(destination: FakeAudioNode) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() {
    this.connections.length = 0;
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(1);
}

export class FakeMediaElementSourceNode extends FakeAudioNode {
  readonly mediaElement: FakeMediaElement;

  constructor(mediaElement: FakeMediaElement) {
    super();
    this.mediaElement = mediaElement;
  }
}

export class FakeMediaElement {
  src = "";
  loop = false;
  preload = "";
  crossOrigin: string | null = null;
  paused = true;
  playCalls = 0;
  pauseCalls = 0;
  /** When set, `play()` rejects with this error. */
  playError: Error | null = null;
  private readonly listeners = new Map<string, Set<() => void>>();

  play(): Promise<void> {
    this.playCalls += 1;
    if (this.playError) return Promise.reject(this.playError);
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  load() {}

  addEventListener(type: string, listener: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }

  emitError() {
    this.emit("error");
  }
}

export interface FakeAudioBuffer {
  readonly duration: number;
  readonly byteLength: number;
}

export class FakeBufferSource extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  readonly startCalls: Array<{ when: number | undefined }> = [];
  stopCalls = 0;

  start(when?: number) {
    this.startCalls.push({ when });
  }

  stop() {
    this.stopCalls += 1;
  }

  emitEnded() {
    this.onended?.();
  }
}

export interface FakeControls {
  /** `fetchArrayBuffer` rejects for these urls. */
  failFetchUrls: Set<string>;
  /** `decodeAudioData` rejects while true. */
  failDecode: boolean;
}

export class FakeAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  onstatechange: (() => void) | null = null;
  readonly destination = new FakeAudioNode();
  readonly gains: FakeGainNode[] = [];
  /** Every media element source created, in order. Its first connection is the deck gain. */
  readonly mediaSources: FakeMediaElementSourceNode[] = [];
  resumeCalls = 0;
  /** When set, `resume()` rejects with this error and the state is unchanged. */
  resumeError: Error | null = null;
  private readonly handles: FakeDepsHandles;

  constructor(handles: FakeDepsHandles) {
    this.handles = handles;
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeError) return Promise.reject(this.resumeError);
    this.setState("running");
    return Promise.resolve();
  }

  /** Simulates the browser changing the context state (e.g. an iOS interruption). */
  setState(state: AudioContextState | "interrupted") {
    this.state = state as AudioContextState;
    this.onstatechange?.();
  }

  createGain(): FakeGainNode {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createMediaElementSource(element: FakeMediaElement) {
    const source = new FakeMediaElementSourceNode(element);
    this.mediaSources.push(source);
    return source;
  }

  createBufferSource(): FakeBufferSource {
    const source = new FakeBufferSource();
    this.handles.bufferSources.push(source);
    return source;
  }

  decodeAudioData(data: ArrayBuffer): Promise<FakeAudioBuffer> {
    if (this.handles.controls.failDecode) {
      return Promise.reject(new Error("decode failed"));
    }
    return Promise.resolve({ duration: 1, byteLength: data.byteLength });
  }
}

export class FakeStorage {
  readonly data = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) {
      this.data.set(key, value);
    }
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

export interface FakeDepsHandles {
  /** Every context created through `deps.createContext`, in order. */
  readonly contexts: FakeAudioContext[];
  readonly mediaElements: FakeMediaElement[];
  /** Buffer sources created by any fake context, in order. */
  readonly bufferSources: FakeBufferSource[];
  /** Urls passed to `deps.fetchArrayBuffer`, in order. */
  readonly fetchedUrls: string[];
  readonly controls: FakeControls;
}

export interface FakeDeps extends FakeDepsHandles {
  readonly deps: AudioEngineDeps;
  /** The first context created, or throws if none was created yet. */
  readonly context: FakeAudioContext;
  /** The storage handed to the engine (undefined when `storage: null`). */
  readonly storage: FakeStorage | undefined;
}

export interface FakeDepsOptions {
  /** Pass `null` to simulate unavailable storage. Defaults to a fresh `FakeStorage`. */
  storage?: AudioEngineDeps["storage"];
  /** Seeds the default `FakeStorage`. Ignored when `storage` is provided. */
  initialStorage?: Record<string, string>;
}

export function createFakeDeps(options: FakeDepsOptions = {}): FakeDeps {
  const handles: FakeDepsHandles = {
    contexts: [],
    mediaElements: [],
    bufferSources: [],
    fetchedUrls: [],
    controls: { failFetchUrls: new Set(), failDecode: false },
  };

  const storage =
    options.storage === undefined
      ? new FakeStorage(options.initialStorage)
      : options.storage;

  const deps: AudioEngineDeps = {
    createContext: () => {
      const context = new FakeAudioContext(handles);
      handles.contexts.push(context);
      return context as unknown as AudioContext;
    },
    createMediaElement: () => {
      const element = new FakeMediaElement();
      handles.mediaElements.push(element);
      return element as unknown as HTMLAudioElement;
    },
    fetchArrayBuffer: (url) => {
      handles.fetchedUrls.push(url);
      if (handles.controls.failFetchUrls.has(url)) {
        return Promise.reject(new Error(`fetch failed: ${url}`));
      }
      return Promise.resolve(new ArrayBuffer(8));
    },
    storage,
  };

  return {
    ...handles,
    deps,
    get context() {
      const first = handles.contexts[0];
      if (!first) throw new Error("No fake AudioContext has been created yet");
      return first;
    },
    storage: storage instanceof FakeStorage ? storage : undefined,
  };
}

/** Narrows a real-typed node from the engine back to its fake for inspection. */
export function asFakeGain(node: GainNode): FakeGainNode {
  return node as unknown as FakeGainNode;
}
