import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function openLibrary() {
  fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
  return within(screen.getByRole("dialog", { name: "Biblioteca de sonidos" }));
}

function search(drawer: ReturnType<typeof within>, value: string) {
  fireEvent.change(drawer.getByRole("searchbox", { name: "Buscar sonido" }), {
    target: { value },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.state.listeners.clear();
});

describe("LibraryDrawer", () => {
  it("opens as a labelled modal dialog and closes with its button, returning focus", () => {
    renderSoundboard();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Biblioteca" });
    const drawer = openLibrary();
    const dialog = screen.getByRole("dialog", { name: "Biblioteca de sonidos" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(drawer.getByRole("searchbox", { name: "Buscar sonido" })).toBeVisible();

    fireEvent.click(drawer.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape and returns focus to the Biblioteca button", () => {
    renderSoundboard();
    openLibrary();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Biblioteca" })).toHaveFocus();
  });

  it("makes the soundboard inert while open", () => {
    renderSoundboard();
    const shell = () =>
      screen.getByRole("navigation", { name: "Escenas", hidden: true }).closest("[inert]");
    expect(shell()).toBeNull();

    openLibrary();
    const dialog = screen.getByRole("dialog");
    expect(shell()).not.toBeNull();
    expect(shell()).not.toContainElement(dialog);
  });

  it("filters with the kind chips and the search box, and reports no matches", () => {
    renderSoundboard();
    const drawer = openLibrary();

    expect(drawer.getByRole("button", { name: "Todo" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const name of ["Música", "Ambiente", "Efectos"]) {
      expect(drawer.getByRole("button", { name })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    expect(drawer.getByRole("button", { name: /Cristal que estalla/ })).toBeVisible();
    expect(drawer.getByRole("button", { name: /Radio de época/ })).toBeVisible();

    fireEvent.click(drawer.getByRole("button", { name: "Música" }));
    expect(drawer.getByRole("button", { name: "Música" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(drawer.getByRole("button", { name: /Radio de época/ })).toBeVisible();
    expect(
      drawer.queryByRole("button", { name: /Cristal que estalla/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(drawer.getByRole("button", { name: "Todo" }));
    search(drawer, "CRÍSTAL");
    expect(drawer.getByRole("button", { name: /Cristal que estalla/ })).toBeVisible();
    expect(drawer.queryByRole("button", { name: /Radio de época/ })).not.toBeInTheDocument();

    search(drawer, "zzzzzz");
    expect(drawer.getByText("No hay sonidos que coincidan")).toBeVisible();
  });

  it("tapping an sfx result plays it", () => {
    renderSoundboard();
    const drawer = openLibrary();

    search(drawer, "cristal");
    fireEvent.click(drawer.getByRole("button", { name: /Cristal que estalla/ }));

    expect(fake.engine.playSfx).toHaveBeenCalledTimes(1);
    expect(fake.engine.playSfx).toHaveBeenCalledWith(getSound("cristal-estalla"));
    expect(fake.engine.setTrack).not.toHaveBeenCalled();
    // The drawer stays open so several sounds can be fired in a row.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("tapping a music result sets the music track without changing the active scene", () => {
    renderSoundboard();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Escenas" })).getByRole("button", {
        name: /Llegada y montacargas/,
      }),
    );
    fake.engine.setTrack.mockClear();

    const drawer = openLibrary();
    fireEvent.click(drawer.getByRole("button", { name: "Música" }));
    fireEvent.click(drawer.getByRole("button", { name: /Misterio e investigación/ }));

    expect(fake.engine.setTrack).toHaveBeenCalledTimes(1);
    expect(fake.engine.setTrack).toHaveBeenCalledWith(
      "music",
      getSound("misterio-investigacion"),
    );
    expect(fake.engine.playSfx).not.toHaveBeenCalled();

    fireEvent.click(drawer.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("button", { name: /Llegada y montacargas/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "Llegada y montacargas" }),
    ).toBeInTheDocument();
  });

  it("tapping an ambience result sets the ambience track", () => {
    renderSoundboard();
    const drawer = openLibrary();

    fireEvent.click(drawer.getByRole("button", { name: "Ambiente" }));
    fireEvent.click(drawer.getByRole("button", { name: /Costa con gaviotas/ }));

    expect(fake.engine.setTrack).toHaveBeenCalledWith(
      "ambience",
      getSound("costa-gaviotas"),
    );
  });

  it("shows a failed sound as unavailable", () => {
    renderSoundboard({ failed: ["cristal-estalla"] });
    const drawer = openLibrary();

    const button = drawer.getByRole("button", { name: /Cristal que estalla/ });
    expect(button).toBeDisabled();
    expect(within(button).getByText("No disponible")).toBeInTheDocument();
  });

  it("leaves the unlock overlay on top if the audio locks again while open", () => {
    renderSoundboard();
    openLibrary();

    act(() => {
      fake.state.snapshot = { ...fake.state.snapshot, unlocked: false };
      for (const listener of [...fake.state.listeners]) listener();
    });

    expect(
      screen.getByRole("button", { name: /Toca para activar el sonido/ }),
    ).toBeInTheDocument();
  });
});
