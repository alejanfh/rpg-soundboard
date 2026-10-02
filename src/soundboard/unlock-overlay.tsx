interface UnlockOverlayProps {
  adventureTitle: string;
  onUnlock: () => void;
}

/** Browsers only start audio after a gesture: one tap anywhere unlocks it. */
export function UnlockOverlay({ adventureTitle, onUnlock }: UnlockOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-title"
      className="fixed inset-0 z-50 bg-abyss/95"
    >
      <button
        type="button"
        autoFocus
        onClick={onUnlock}
        className="flex size-full flex-col items-center justify-center gap-6 px-6 text-center"
      >
        <span className="text-base text-verdigris">{adventureTitle}</span>
        <span className="flex size-28 items-center justify-center rounded-full border-2 border-brass-bright bg-brass shadow-[0_0_40px_rgb(240_205_122/0.35)]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 fill-abyss">
            <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
          </svg>
        </span>
        <span
          id="unlock-title"
          className="max-w-xl font-display text-4xl leading-tight text-brass-bright sm:text-5xl"
        >
          Toca para activar el sonido
        </span>
        <span className="max-w-sm text-base leading-relaxed text-mist">
          Si usas un iPad, comprueba que el interruptor de silencio esté desactivado
        </span>
      </button>
    </div>
  );
}
