# RPG Soundboard — Design Spec

- **Date:** 2026-10-02
- **Status:** Approved in conversation, pending written-spec review
- **Owner:** Alejandro (single user, game master)

## 1. Purpose

A personal web soundboard that a tabletop RPG game master keeps next to them (iPad, laptop or phone) while running a session. The GM picks an adventure, moves from scene to scene, and the app crossfades the scene's ambient music and ambience, while offering one-tap sound effects and a short per-scene cheat sheet that says which sound to fire and when.

**Success looks like:** the GM runs *La última inspección* (El Rastro de Cthulhu) from start to finish using only this app, without fumbling, without audio glitches on iPad, and without touching any menu deeper than one tap.

### What the user said (confirmed)

- Next.js + React, deployed on Vercel.
- Single user. Content (adventures, sounds) is curated by the AI agent through conversation and redeployed. No in-app editing, no uploads, no backend.
- A global sound library that grows over time. Each adventure curates the best sounds per scene (no fixed count). The full library is still reachable during play.
- Always online (sessions happen at home with Wi-Fi). No offline mode.
- Music + optional ambience loop per scene, one-shot SFX buttons, ~3 s crossfade, independent per-layer volume, "silence all" panic button.
- Short cheat sheet per scene.
- Public site without password is acceptable for now.
- UI and content in Spanish; code in English.
- All adventures are El Rastro de Cthulhu for now. Other systems are out of scope.

### Assumptions (stated, not contested)

- Music, ambience and SFX can play simultaneously.
- Touch-first UI; the iPad is the primary device.
- Tracks are 2–5 minutes long; loop repetition is acceptable.

## 2. Non-goals (YAGNI)

- Accounts, authentication, password protection.
- Backend, database, file uploads, in-app editor.
- Offline/PWA caching.
- Multiple game systems, player-facing views, remote control, Discord streaming.
- Adaptive intensity stems, playlists/queues, random silence gaps.

## 3. Stack

- Next.js (App Router) with `output: 'export'` (fully static), TypeScript strict mode.
- Styling: Tailwind CSS.
- Tests: Vitest (+ jsdom where needed).
- No audio library: a custom engine on the Web Audio API (see §6).
- Audio files under `public/audio/{music,ambience,sfx}/`.
- Dev-only tooling for audio processing: `ffmpeg-static` (system ffmpeg is not installed) used by scripts under `scripts/`.
- Hosting: Vercel (static). The user logs in to Vercel when deploying.

## 4. Architecture

Screaming architecture: top-level folders name the domain, not the framework.

```
src/
  app/                       Next.js routes, composition only
    page.tsx                 Adventure list
    partidas/[id]/page.tsx   Soundboard for one adventure (generateStaticParams)
    creditos/page.tsx        Credits, generated from the sound library
  audio-engine/              Framework-agnostic Web Audio engine (no React)
  sound-library/             Global catalog of sounds (grows over time)
  adventures/                One file per adventure + index
  soundboard/                React components and hooks for the table view
public/audio/{music,ambience,sfx}/
scripts/                     Dev-only: sourcing, normalization, synthesis
```

Dependency direction: `app → soundboard → (audio-engine, sound-library, adventures)`. `adventures` depends on `sound-library` ids only. `audio-engine` depends on nothing in the project.

## 5. Data model

```ts
type SoundKind = 'music' | 'ambience' | 'sfx';

interface SoundCredit {
  author: string;
  source: 'freesound' | 'incompetech' | 'internet-archive' | 'opengameart' | 'generated';
  license: 'CC0' | 'CC-BY-4.0' | 'public-domain' | 'generated';
  url?: string;          // required unless source is 'generated'
}

interface Sound {
  id: string;            // kebab-case, unique, stable
  title: string;         // Spanish, shown on buttons
  kind: SoundKind;
  src: string;           // path under /audio
  tags: string[];        // Spanish search terms
  credit: SoundCredit;
}

interface SceneCue {
  moment: string;        // Spanish, e.g. "Antes de que lleguen al hall"
  soundIds: string[];    // one or more sounds fired by the cue button
}

interface Scene {
  id: string;
  title: string;
  musicId?: string;      // omitted = no music (silence is a tool)
  ambienceId?: string;
  sfxIds: string[];      // curated selection for this scene
  cues: SceneCue[];      // the cheat sheet
}

interface Adventure {
  id: string;
  title: string;
  system: 'el-rastro-de-cthulhu';
  synopsis: string;
  scenes: Scene[];
}
```

### Integrity rules (enforced by tests)

1. Every referenced sound id exists in the library and has the right `kind` for its slot (`musicId` → music, `ambienceId` → ambience, `sfxIds` → sfx; cue sounds can be any kind).
2. Sound ids and adventure ids are unique; scene ids are unique within an adventure.
3. Every `src` exists on disk under `public/`.
4. Every sound has a credit; non-generated sounds have a URL; licenses are in the allowed set.
5. Adventures never duplicate sound data; they reference ids only.

## 6. Audio engine

A single `AudioEngine` instance owning one `AudioContext`.

**Graph:** `music bus`, `ambience bus`, `sfx bus` → `master gain` → `destination`.

**Music and ambience channels** (one each): two decks (A/B). A deck is an `HTMLAudioElement` (`loop = true`, streaming) routed through `MediaElementAudioSourceNode` → deck `GainNode` → bus. Routing through Web Audio is mandatory: iOS ignores `HTMLMediaElement.volume`, so fades and volume must happen on gain nodes. Switching track runs an equal-power crossfade of 3 s between decks. Setting the same track that is already playing is a no-op. Setting `undefined` fades the channel out.

**SFX:** decoded `AudioBuffer`s played via `AudioBufferSourceNode`. The adventure's curated SFX are fetched and decoded when the adventure opens. Library SFX decode lazily on first use and are cached. Polyphonic. `stopAllSfx()` stops active SFX sources.

**Silence:** `silence()` fades master to 0 in ~400 ms; `resume()` restores. Buses keep their user volumes.

**Unlock:** the context is created/resumed inside a user gesture ("Toca para activar el sonido" overlay). If the context becomes `suspended`/`interrupted` (e.g. iOS phone call), the overlay reappears.

**State and errors:** the engine exposes a subscribable snapshot (current music/ambience ids, volumes, silenced flag, unlock state, per-sound load errors). React consumes it via `useSyncExternalStore`. Load or decode failures never throw to the UI: the sound is marked failed, its button shows the error state, a toast informs the GM, and everything else keeps playing.

**Volumes** (music, ambience, sfx) persist in `localStorage`.

**Screen Wake Lock** is requested while the soundboard is open and re-requested on `visibilitychange`.

## 7. UI

All copy in Spanish. Dark theme for low-light tables, high contrast, 1930s-flavoured display typography for titles, no distracting animation. Visual direction is developed during implementation with the `frontend-design` skill.

- **Home (`/`):** adventure cards (title, system, synopsis).
- **Soundboard (`/partidas/[id]`):** one screen, no deep menus.
  - Scene list: side column on tablet/desktop, horizontal strip on phone. Tapping a scene crossfades to its music/ambience and shows its panel. Active scene highlighted.
  - Active scene panel: cheat sheet (each cue has a button firing its sounds) above a grid of large SFX buttons (min 64 px touch target).
  - Mixer: three sliders (Música, Ambiente, Efectos).
  - Always-visible **SILENCIO** button with **Reanudar**; a "cortar efectos" button.
  - Library drawer: search by title/tag, filter by kind. Tapping an SFX plays it; tapping music/ambience replaces the current layer without changing scene.
  - Unlock overlay with a hint about the iPad silent switch.
- **Credits (`/creditos`):** generated from the library; satisfies CC-BY attribution.

## 8. Content

### Audio sourcing policy

| Need | Source | License |
|---|---|---|
| SFX, ambience recordings | Freesound HQ previews, CC0 filter only, verified per sound page | CC0 |
| Dark/horror music | Incompetech (Kevin MacLeod) | CC-BY 4.0 (credited) |
| Drones, underground hum | Generated by a script | Generated |
| Period radio jazz | Recordings published 1925 or earlier (US public domain), or MacLeod 1920s-style tracks | Public domain / CC-BY 4.0 |
| Extra loops/drones | OpenGameArt, CC0 only | CC0 |

Excluded: Pixabay, BBC RemArc, Tabletop Audio, Sonniss (license incompatible with public redistribution or unverifiable). No 1926+ recordings (not US public domain).

All files are loudness-normalized (ffmpeg `loudnorm`) and encoded as MP3 (good iOS support). Target sizes: SFX < 300 KB, loops 2–5 min.

### First adventure: *La última inspección en el acuario*

Eastbourne, 1934, a luxury aquarium three months before opening. Nine scenes:

1. `llegada-montacargas` — arrival by limousine, guard, freight lift down. Music: muffled period radio, then underground hum.
2. `hall-exposicion` — hall with freshwater tank 1, guided tour starts.
3. `visita-guiada` — tanks, maintenance room, bleachers; ends in the blackout.
4. `sala-generador` — burst pipe, dead main generator, emergency generator.
5. `muerte-en-el-hall` — glass crash and scream, Summers dead under jellyfish.
6. `investigacion` — lockers, offices, control room, diary.
7. `pasarelas-tanques` — catwalks over saltwater tanks, lilac glint.
8. `enfrentamiento-final` — mermaid creatures attack, statuette trance.
9. `resolucion` — generator restarts, lift, outcome.

Each scene gets the sounds it needs (fewer for short scenes, more for the climax) plus cues for key moments: blackout, glass + scream before arrival, body reveal, "all fish stare", lilac glint, mermaid attack, statuette trance, statuette shattering, generator restart. Cheat sheet text is short GM prompts, not reproduced adventure text.

Global SFX useful across Cthulhu adventures (sanity-loss stinger, gunshot, footsteps, door creak, scream, heartbeat, thunder) live in the library and are curated into scenes where relevant.

## 9. Testing

- **TDD** (red → green → refactor) for `audio-engine` (with a fake `AudioContext`/media element: crossfade scheduling, no-op on same track, silence/resume, SFX caching, error marking) and for the data integrity rules in §5.
- Light component tests only where logic lives (library search filtering).
- Manual smoke test in a browser before each deploy: unlock, scene switch crossfade, SFX, silence, library search, credits page.
- `npm run build` (static export), `npm run lint`, `npm test` all green before deploy.

## 10. Extending later (the maintenance workflow)

The user asks in conversation; the agent:
1. Adds new sounds to `sound-library` with credits and files (normalized).
2. Adds a new file under `adventures/` and registers it in the index.
3. Runs tests (integrity catches broken references) and redeploys.

If the library outgrows the repo comfortably, audio can move to external storage by changing `src` resolution only.
