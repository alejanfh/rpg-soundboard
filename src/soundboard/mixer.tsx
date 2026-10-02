"use client";

import { useId } from "react";
import type { Layer } from "@/audio-engine";

const CHANNELS: readonly { layer: Layer; label: string }[] = [
  { layer: "music", label: "Música" },
  { layer: "ambience", label: "Ambiente" },
  { layer: "sfx", label: "Efectos" },
];

interface MixerProps {
  volumes: Record<Layer, number>;
  onChange: (layer: Layer, value: number) => void;
}

/** Three faders: 0–100 on screen, 0–1 for the engine. */
export function Mixer({ volumes, onChange }: MixerProps) {
  const baseId = useId();
  return (
    <div role="group" aria-label="Volumen" className="grid flex-1 grid-cols-3 gap-4">
      {CHANNELS.map(({ layer, label }) => {
        const id = `${baseId}-${layer}`;
        const percent = Math.round(volumes[layer] * 100);
        return (
          <div key={layer} className="min-w-0">
            <div className="flex items-baseline justify-between text-sm">
              <label htmlFor={id} className="text-bone">
                {label}
              </label>
              <span aria-hidden="true" className="tabular-nums text-mist">
                {percent}
              </span>
            </div>
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={1}
              value={percent}
              onChange={(event) => onChange(layer, Number(event.target.value) / 100)}
              className="h-8 w-full cursor-pointer"
            />
          </div>
        );
      })}
    </div>
  );
}
