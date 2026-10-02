"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { searchSounds, sounds, type Sound, type SoundKind } from "@/sound-library";
import { SoundButton } from "./sound-button";

type KindFilter = SoundKind | "all";

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "music", label: "Música" },
  { value: "ambience", label: "Ambiente" },
  { value: "sfx", label: "Efectos" },
];

const KIND_LABELS: Record<SoundKind, string> = {
  music: "Música",
  ambience: "Ambiente",
  sfx: "Efecto",
};

interface LibraryDrawerProps {
  failed: ReadonlySet<string>;
  onClose: () => void;
  /** Called for every sound; the caller decides one-shot vs. loop by kind. */
  onPick: (sound: Sound) => void;
}

/**
 * Searchable list of the whole library, for sounds a scene did not plan for.
 * A modal dialog: the caller makes the rest of the page inert while it is
 * mounted, and restores focus to the opener after it unmounts.
 */
export function LibraryDrawer({ failed, onClose, onPick }: LibraryDrawerProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const dialogRef = useRef<HTMLDivElement>(null);
  const results = useMemo(
    () => searchSounds(sounds, query, kind === "all" ? undefined : kind),
    [query, kind],
  );

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-abyss/70">
      {/* Tapping the dimmed area closes the drawer; keyboard users have Escape. */}
      <div aria-hidden="true" className="absolute inset-0" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative flex h-full w-full max-w-md flex-col border-l border-brass/40 bg-abyss shadow-2xl outline-none"
      >
        <header className="flex items-center gap-3 border-b border-brass/30 px-4 py-2">
          <h2
            id="library-title"
            className="min-w-0 flex-1 truncate font-display text-2xl text-brass-bright"
          >
            Biblioteca de sonidos
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 shrink-0 items-center rounded-md border border-kelp px-4 text-base text-bone hover:border-verdigris"
          >
            Cerrar
          </button>
        </header>

        <div className="flex flex-col gap-3 border-b border-kelp px-4 py-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-verdigris">Buscar sonido</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="min-h-12 rounded-md border border-kelp bg-tank px-3 text-base text-bone placeholder:text-mist"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={kind === filter.value}
                onClick={() => setKind(filter.value)}
                className="min-h-11 rounded-full border border-kelp px-4 text-base text-mist hover:border-verdigris aria-pressed:border-brass aria-pressed:bg-brass aria-pressed:text-abyss"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {results.length === 0 ? (
            <p className="py-8 text-center text-lg text-mist">
              No hay sonidos que coincidan
            </p>
          ) : (
            <ul className="grid gap-2">
              {results.map((sound) => (
                <li key={sound.id}>
                  <SoundButton
                    sound={sound}
                    failed={failed.has(sound.id)}
                    caption={KIND_LABELS[sound.kind]}
                    onPlay={onPick}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
