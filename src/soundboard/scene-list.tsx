import type { Scene } from "@/adventures";

interface SceneListProps {
  scenes: Scene[];
  activeSceneId: string | null;
  onSelect: (scene: Scene) => void;
}

/**
 * The scenes in play order, drawn as the freight lift's floor indicator:
 * the lit brass dial is the scene that is playing.
 */
export function SceneList({ scenes, activeSceneId, onSelect }: SceneListProps) {
  return (
    <nav aria-label="Escenas">
      <ol className="flex gap-2 overflow-x-auto px-4 py-3 md:flex-col md:gap-1 md:overflow-visible md:px-3">
        {scenes.map((scene, index) => {
          const active = scene.id === activeSceneId;
          return (
            <li key={scene.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(scene)}
                className={`relative flex min-h-16 w-40 items-center gap-3 rounded-md px-2 py-2 text-left md:w-full ${
                  active ? "bg-tank" : "hover:bg-tank/60"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 font-display text-lg ${
                    active
                      ? "border-brass-bright bg-brass text-abyss shadow-[0_0_18px_rgb(240_205_122/0.45)]"
                      : "border-brass/50 text-brass"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`line-clamp-2 text-[0.95rem] leading-tight ${
                    active ? "text-bone" : "text-mist"
                  }`}
                >
                  <span className="sr-only">Escena {index + 1}: </span>
                  {scene.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
