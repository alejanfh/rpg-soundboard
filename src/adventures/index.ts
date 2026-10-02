import { laUltimaInspeccion } from "./la-ultima-inspeccion";
import type { Adventure } from "./types";

export type { Adventure, Scene, SceneCue } from "./types";

export const adventures: Adventure[] = [laUltimaInspeccion];

export function getAdventure(id: string): Adventure | undefined {
  return adventures.find((adventure) => adventure.id === id);
}
