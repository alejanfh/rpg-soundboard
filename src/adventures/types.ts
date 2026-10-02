export interface SceneCue {
  /** Spanish, e.g. "Antes de que lleguen al hall" */
  moment: string;
  /** One or more sounds fired by the cue button */
  soundIds: string[];
}

export interface Scene {
  id: string;
  title: string;
  /** Omitted = no music (silence is a tool) */
  musicId?: string;
  ambienceId?: string;
  /** Curated selection for this scene */
  sfxIds: string[];
  /** The cheat sheet */
  cues: SceneCue[];
}

export interface Adventure {
  id: string;
  title: string;
  system: "el-rastro-de-cthulhu";
  synopsis: string;
  scenes: Scene[];
}
