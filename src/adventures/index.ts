import type { Adventure } from "./types";

export type { Adventure, Scene, SceneCue } from "./types";

export const adventures: Adventure[] = [];

export function getAdventure(id: string): Adventure | undefined {
  return adventures.find((adventure) => adventure.id === id);
}
