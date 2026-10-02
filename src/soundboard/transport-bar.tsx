interface TransportBarProps {
  silenced: boolean;
  onSilence: () => void;
  onResume: () => void;
  onStopSfx: () => void;
}

/** The always-visible master controls. */
export function TransportBar({
  silenced,
  onSilence,
  onResume,
  onStopSfx,
}: TransportBarProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onStopSfx}
        className="min-h-16 flex-1 rounded-md border border-kelp px-4 text-base text-bone hover:border-verdigris active:bg-kelp md:flex-none"
      >
        Cortar efectos
      </button>
      {silenced ? (
        <button
          type="button"
          onClick={onResume}
          className="min-h-16 flex-[1.4] rounded-md bg-brass px-6 text-lg font-semibold text-abyss hover:bg-brass-bright md:min-w-44 md:flex-none"
        >
          Reanudar
        </button>
      ) : (
        <button
          type="button"
          onClick={onSilence}
          className="min-h-16 flex-[1.4] rounded-md bg-oxblood px-6 text-lg font-semibold tracking-[0.18em] text-bone ring-1 ring-coral/40 hover:bg-[#a5322c] md:min-w-44 md:flex-none"
        >
          SILENCIO
        </button>
      )}
    </div>
  );
}
