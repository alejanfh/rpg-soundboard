import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdventure } from "@/adventures";
import type { EngineSnapshot } from "@/audio-engine";
import { getSound } from "@/sound-library";
import { Soundboard } from "./soundboard";

const fake = vi.hoisted(() => {
  const state = {
    snapshot: null as unknown as EngineSnapshot,
    listeners: new Set<() => void>(),
  };
  const engine = {
    getSnapshot: () => state.snapshot,
    subscribe: (listener: () => void) => {
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },
    unlock: vi.fn(() => Promise.resolve()),
    setTrack: vi.fn(),
    playSfx: vi.fn(() => Promise.resolve()),
    preloadSfx: vi.fn(() => Promise.resolve()),
    stopAllSfx: vi.fn(),
    stopAll: vi.fn(),
    silence: vi.fn(),
    resume: vi.fn(),
    setVolume: vi.fn(),
  };
  return { state, engine };
});

vi.mock("@/audio-engine/browser-engine", () => ({
  getBrowserEngine: () => fake.engine,
}));

const adventure = getAdventure("la-ultima-inspeccion")!;

function setSnapshot(patch: Partial<EngineSnapshot>) {
  act(() => {
    fake.state.snapshot = { ...fake.state.snapshot, ...patch };
    for (const listener of [...fake.state.listeners]) listener();
  });
}

function renderSoundboard(initial: Partial<EngineSnapshot> = {}) {
  fake.state.snapshot = {
    unlocked: true,
    silenced: false,
    volumes: { music: 0.6, ambience: 0.5, sfx: 0.8 },
    current: {},
    failed: [],
    ...initial,
  };
  return render(<Soundboard adventure={adventure} />);
}

function sceneButton(title: RegExp) {
  return within(screen.getByRole("navigation", { name: "Escenas" })).getByRole(
    "button",
    { name: title },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.state.listeners.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Soundboard", () => {
  it("shows unlock overlay until unlocked", () => {
    renderSoundboard({ unlocked: false });

    expect(screen.getByText("Toca para activar el sonido")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Si usas un iPad, comprueba que el interruptor de silencio esté desactivado",
      ),
    ).toBeInTheDocument();
    expect(fake.engine.preloadSfx).not.toHaveBeenCalled();
    const shell = () =>
      screen.getByRole("navigation", { name: "Escenas", hidden: true }).closest("[inert]");
    expect(shell()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Toca para activar el sonido/ }));
    expect(fake.engine.unlock).toHaveBeenCalledTimes(1);

    setSnapshot({ unlocked: true });

    expect(screen.queryByText("Toca para activar el sonido")).not.toBeInTheDocument();
    expect(shell()).toBeNull();
  });

  it("also requests the screen wake lock inside the unlock tap", async () => {
    const request = vi.fn(() => Promise.resolve({ release: () => Promise.resolve() }));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    try {
      renderSoundboard({ unlocked: false });
      await act(() => Promise.resolve());
      const onMount = request.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: /Toca para activar el sonido/ }));
      await act(() => Promise.resolve());

      expect(request.mock.calls.length).toBe(onMount + 1);
    } finally {
      Reflect.deleteProperty(navigator, "wakeLock");
    }
  });

  it("preloads every scene and cue sfx once unlocked", () => {
    renderSoundboard({ unlocked: false });
    setSnapshot({ unlocked: true });

    expect(fake.engine.preloadSfx).toHaveBeenCalledTimes(1);
    const preloaded = (fake.engine.preloadSfx.mock.calls[0] as unknown[])[0] as {
      id: string;
    }[];
    const ids = preloaded.map((sound) => sound.id);
    // scene sfx, cue-only sfx, deduplicated, and no music/ambience
    expect(ids).toContain("coche-grava");
    expect(ids).toContain("golpe-tension");
    expect(ids).toContain("susurros");
    expect(ids).not.toContain("trance-hipnotico");
    expect(ids).not.toContain("costa-gaviotas");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("selecting a scene sets its music and ambience", () => {
    renderSoundboard();

    expect(screen.getByText("Elige una escena para empezar")).toBeInTheDocument();
    expect(fake.engine.setTrack).not.toHaveBeenCalled();

    fireEvent.click(sceneButton(/Llegada y montacargas/));
    expect(fake.engine.setTrack).toHaveBeenCalledWith("music", getSound("radio-epoca"));
    expect(fake.engine.setTrack).toHaveBeenCalledWith(
      "ambience",
      getSound("costa-gaviotas"),
    );
    expect(sceneButton(/Llegada y montacargas/)).toHaveAttribute("aria-pressed", "true");

    fake.engine.setTrack.mockClear();
    fireEvent.click(sceneButton(/Sala del generador/));
    expect(fake.engine.setTrack).toHaveBeenCalledWith("music", undefined);
    expect(fake.engine.setTrack).toHaveBeenCalledWith(
      "ambience",
      getSound("sala-maquinas"),
    );
    expect(sceneButton(/Llegada y montacargas/)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { name: "Sala del generador" })).toBeInTheDocument();
  });

  // Only proves the UI re-requests its tracks (covers calls dropped while
  // locked). With the same ids the engine treats them as no-ops; restarting
  // tracks an interruption paused is AudioEngine.unlock()'s job, covered in
  // audio-engine.tracks.test.ts.
  it("re-requests the active scene tracks after a re-unlock", () => {
    renderSoundboard();
    fireEvent.click(sceneButton(/Llegada y montacargas/));
    setSnapshot({ unlocked: false });
    fake.engine.setTrack.mockClear();

    setSnapshot({ unlocked: true });

    expect(fake.engine.setTrack).toHaveBeenCalledWith("music", getSound("radio-epoca"));
    expect(fake.engine.setTrack).toHaveBeenCalledWith(
      "ambience",
      getSound("costa-gaviotas"),
    );
  });

  it("renders cues and fires them on tap", () => {
    renderSoundboard();
    fireEvent.click(sceneButton(/Enfrentamiento final/));
    fake.engine.setTrack.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Arrastran a Cindy bajo el agua/ }));
    expect(fake.engine.playSfx).toHaveBeenCalledWith(getSound("grito-mujer"));
    expect(fake.engine.playSfx).toHaveBeenCalledWith(getSound("zambullida"));

    fireEvent.click(screen.getByRole("button", { name: /Al mirar la estatuilla/ }));
    expect(fake.engine.setTrack).toHaveBeenCalledWith(
      "music",
      getSound("trance-hipnotico"),
    );
    // A cue never changes the active scene.
    expect(sceneButton(/Enfrentamiento final/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Disparo de revólver" }));
    expect(fake.engine.playSfx).toHaveBeenCalledWith(getSound("disparo-revolver"));
  });

  it("silence button toggles to Reanudar", () => {
    renderSoundboard();

    fireEvent.click(screen.getByRole("button", { name: "SILENCIO" }));
    expect(fake.engine.silence).toHaveBeenCalledTimes(1);

    setSnapshot({ silenced: true });
    expect(screen.queryByRole("button", { name: "SILENCIO" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reanudar" }));
    expect(fake.engine.resume).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cortar efectos" }));
    expect(fake.engine.stopAllSfx).toHaveBeenCalledTimes(1);
  });

  it("maps mixer sliders to engine volumes", () => {
    renderSoundboard();

    const music = screen.getByRole("slider", { name: "Música" });
    expect(music).toHaveValue("60");
    fireEvent.change(music, { target: { value: "25" } });
    expect(fake.engine.setVolume).toHaveBeenCalledWith("music", 0.25);

    fireEvent.change(screen.getByRole("slider", { name: "Efectos" }), {
      target: { value: "100" },
    });
    expect(fake.engine.setVolume).toHaveBeenCalledWith("sfx", 1);
    expect(screen.getByRole("slider", { name: "Ambiente" })).toHaveValue("50");
  });

  it("failed sound button is disabled", () => {
    vi.useFakeTimers();
    renderSoundboard();
    fireEvent.click(sceneButton(/El hall y la exposición/));

    setSnapshot({ failed: ["latido"] });

    expect(screen.getByRole("button", { name: /Latido/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo cargar: Latido");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("No se pudo cargar");

    // Shown once per id: a later failure does not bring the first one back.
    setSnapshot({ failed: ["latido", "pasos-baldosa"] });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No se pudo cargar: Pasos en baldosa",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("Latido");
  });

  it("stops all sound on unmount", () => {
    const { unmount } = renderSoundboard();
    unmount();
    expect(fake.engine.stopAll).toHaveBeenCalledTimes(1);
  });
});
