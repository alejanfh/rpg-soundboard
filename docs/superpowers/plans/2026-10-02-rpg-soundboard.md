# RPG Soundboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Next.js soundboard where a GM opens *La última inspección*, switches scenes with crossfaded music/ambience, fires SFX and cue buttons, and searches the full sound library — deployed on Vercel.

**Architecture:** Fully static export. Content (sound library + adventures) is typed TypeScript data validated by tests. A framework-agnostic `AudioEngine` (Web Audio API) streams music/ambience through gain nodes and plays decoded SFX buffers; React consumes it via `useSyncExternalStore`.

**Tech Stack:** Next.js (latest, App Router, `output: 'export'`), React, TypeScript strict, Tailwind CSS, Vitest + jsdom + Testing Library, `ffmpeg-static` (dev scripts only), Vercel.

**Spec:** `docs/superpowers/specs/2026-10-02-rpg-soundboard-design.md`

## Global Constraints

- All UI copy and content (titles, cues, tags, synopsis) in neutral Spanish; identifiers, comments, commit messages in English.
- Static export only: no API routes, no server actions, no runtime server code.
- No audio library dependency (no Howler, no Tone.js).
- iOS: all volume/fades on `GainNode`s; never rely on `HTMLMediaElement.volume`.
- Allowed licenses: `CC0`, `CC-BY-4.0`, `public-domain`, `generated`. Excluded sources: Pixabay, BBC RemArc, Tabletop Audio, Sonniss. No recordings published 1926 or later.
- Audio files: MP3 at `public/audio/<kind>/<id>.mp3`; SFX < 300 KB; music/ambience loops 2–5 min.
- Crossfade 3 s equal-power; silence fade 0.4 s.
- Touch targets ≥ 64 px for SFX/cue buttons.
- Commits: Conventional Commits, no AI attribution / Co-Authored-By trailers.
- Work on branch `feat/rpg-soundboard` (create it before Task 1's commit).

## Review Focus

1. Rapid scene switching (three scenes tapped within 3 s) must end with only the last scene's track audible — no orphaned decks left at non-zero gain. Pinned in Task 4.
2. Changing scene while silenced must not blast audio: master stays at 0 until `resume()`. Pinned in Task 4.
3. iOS interrupting the context mid-session (`interrupted`/`suspended`) must re-show the unlock overlay. Pinned in Task 3.
4. Corrupt or unavailable `localStorage` must fall back to default volumes without throwing. Pinned in Task 3.
5. Library search must be case- and accent-insensitive ("CRISTAL", "crístal" → "Cristal que estalla"). Pinned in Task 9.

---

### Task 1: Project scaffold

**Files:**
- Create: Next.js app in repo root (`package.json`, `next.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/page.tsx`, Tailwind config/CSS, ESLint config), `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Produces: scripts `npm run dev`, `npm run build` (static export to `out/`), `npm run lint`, `npm test` (`vitest run`); import alias `@/*` → `src/*`.

- [ ] **Step 1:** `git checkout -b feat/rpg-soundboard`.
- [ ] **Step 2:** Scaffold with `npx create-next-app@latest` (TypeScript, Tailwind, ESLint, App Router, `src/` dir, alias `@/*`, npm). The repo already contains `docs/` and `.git`; if the CLI refuses a non-empty dir, scaffold into the scratchpad and copy everything except `.git` into the repo root.
- [ ] **Step 3:** Set `output: 'export'` and `images: { unoptimized: true }` in `next.config.ts`; ensure `"strict": true` in `tsconfig.json`; set `<html lang="es">` in `layout.tsx`.
- [ ] **Step 4:** Install `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, `vite-tsconfig-paths` as dev deps; configure `vitest.config.ts` (environment `jsdom`, setup file importing `@testing-library/jest-dom/vitest`); add `"test": "vitest run"`.
- [ ] **Step 5:** Write `src/smoke.test.ts` asserting `1 + 1 === 2`; run `npm test` → PASS.
- [ ] **Step 6:** Run `npm run build` → succeeds and creates `out/index.html`; `npm run lint` → no errors.
- [ ] **Step 7:** Commit `chore: scaffold next.js static app with vitest`.

---

### Task 2: Domain types and content integrity

**Files:**
- Create: `src/sound-library/types.ts`, `src/sound-library/sounds.ts`, `src/sound-library/index.ts`, `src/adventures/types.ts`, `src/adventures/index.ts`, `src/content-integrity/validate-content.ts`
- Test: `src/content-integrity/validate-content.test.ts`, `src/content-integrity/content.test.ts`

**Interfaces:**
- Produces:
  - Types exactly as spec §5: `SoundKind`, `SoundCredit`, `Sound`, `SceneCue`, `Scene`, `Adventure`.
  - `sounds: Sound[]` (starts empty `[]`), `getSound(id: string): Sound | undefined`, `soundSrc(kind: SoundKind, id: string): string` → `` `/audio/${kind}/${id}.mp3` ``.
  - `adventures: Adventure[]` (starts empty), `getAdventure(id: string): Adventure | undefined`.
  - `validateContent(sounds: Sound[], adventures: Adventure[], fileExists: (publicPath: string) => boolean): string[]` — returns human-readable error strings, empty when valid.

- [ ] **Step 1: Write failing tests** in `validate-content.test.ts` using small inline fixtures. One test per rule, each asserting the returned array contains a message mentioning the offending id:
  - `reports unknown sound id referenced by a scene`
  - `reports music slot pointing to a non-music sound` (same for ambience and sfx slots)
  - `accepts cue sounds of any kind`
  - `reports duplicate sound ids`, `reports duplicate adventure ids`, `reports duplicate scene ids within an adventure`
  - `reports missing audio file` (fileExists returns false)
  - `reports non-generated credit without url`
  - `reports license outside the allowed set`
  - `returns empty array for valid content`
- [ ] **Step 2:** `npx vitest run src/content-integrity` → FAIL (module not found).
- [ ] **Step 3:** Implement types and `validateContent`.
- [ ] **Step 4:** Write `content.test.ts`: `validateContent(sounds, adventures, p => fs.existsSync(path.join(process.cwd(), 'public', p)))` equals `[]`. This is the permanent gate for real content.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: add content model and integrity validation`.

---

### Task 3: Audio engine core (context, buses, volumes, silence, unlock)

**Files:**
- Create: `src/audio-engine/types.ts`, `src/audio-engine/audio-engine.ts`, `src/audio-engine/index.ts`
- Test: `src/audio-engine/test-doubles.ts`, `src/audio-engine/audio-engine.core.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  type Layer = 'music' | 'ambience' | 'sfx';
  type TrackLayer = 'music' | 'ambience';
  interface PlayableSound { id: string; src: string }
  interface EngineSnapshot {
    unlocked: boolean;
    silenced: boolean;
    volumes: Record<Layer, number>;           // 0..1
    current: Partial<Record<TrackLayer, string>>; // sound ids
    failed: readonly string[];                // sound ids that failed to load
  }
  interface AudioEngineDeps {
    createContext: () => AudioContext;
    createMediaElement: () => HTMLAudioElement;
    fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
    storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  }
  ```
- Produces (`audio-engine.ts`): `class AudioEngine` with `constructor(deps)`, `unlock(): Promise<void>`, `getSnapshot(): EngineSnapshot`, `subscribe(listener: () => void): () => void`, `setVolume(layer: Layer, value: number): void`, `silence(): void`, `resume(): void`. Constants exported: `CROSSFADE_SECONDS = 3`, `SILENCE_FADE_SECONDS = 0.4`, `DEFAULT_VOLUMES = { music: 0.6, ambience: 0.5, sfx: 0.8 }`, `VOLUMES_STORAGE_KEY = 'rpg-soundboard:volumes'`.
- `test-doubles.ts` produces `createFakeDeps()` returning deps plus inspection handles: fake context with `state`, `currentTime` (settable), `resume()`, `onstatechange`, fake `GainNode` recording `gain.value` and automation calls (`setValueAtTime`, `linearRampToValueAtTime`, `setValueCurveAtTime`, `cancelScheduledValues`), fake media elements (record `src`, `play()`, `pause()`, can emit `error`), fake buffer sources (record `start`/`stop`), configurable fetch/decode failures.

- [ ] **Step 1: Write failing tests:**
  - `starts locked with default volumes`
  - `unlock creates one context, resumes it, and sets unlocked` (calling twice creates one context)
  - `setVolume clamps to 0..1, updates the bus gain, persists to storage, and notifies subscribers`
  - `loads persisted volumes on construction`
  - `falls back to defaults when storage is null, throws, or holds invalid JSON` (Review Focus 4)
  - `silence ramps master to 0 over SILENCE_FADE_SECONDS and resume ramps back to 1; snapshot.silenced toggles`
  - `context state change to interrupted or suspended sets unlocked false` (Review Focus 3)
  - `getSnapshot returns the same object until something changes` (required by `useSyncExternalStore`)
- [ ] **Step 2:** `npx vitest run src/audio-engine` → FAIL.
- [ ] **Step 3:** Implement. Graph: bus gains (music, ambience, sfx) → master gain → destination, created on first `unlock()`. Methods other than `setVolume` are no-ops before unlock.
- [ ] **Step 4:** `npx vitest run src/audio-engine` → PASS.
- [ ] **Step 5:** Commit `feat: add audio engine core with buses, volumes and silence`.

---

### Task 4: Audio engine track channels (music/ambience crossfade)

**Files:**
- Modify: `src/audio-engine/audio-engine.ts`
- Test: `src/audio-engine/audio-engine.tracks.test.ts`

**Interfaces:**
- Consumes: Task 3 engine and doubles.
- Produces: `setTrack(layer: TrackLayer, sound: PlayableSound | undefined): void`, `stopAll(): void` (fades both track layers out and stops all SFX; used when leaving an adventure).

- [ ] **Step 1: Write failing tests:**
  - `setTrack starts a looping media element routed through a deck gain and ramps it in over CROSSFADE_SECONDS`
  - `switching track crossfades: incoming deck ramps 0→1, outgoing 1→0 with equal-power curves, and outgoing element is paused after the fade`
  - `setting the currently playing track is a no-op`
  - `setTrack(layer, undefined) fades the layer out and clears snapshot.current[layer]`
  - `rapid switching A→B→C within the crossfade window leaves only C at non-zero target gain and pauses A and B` (Review Focus 1)
  - `setTrack while silenced keeps master at 0` (Review Focus 2)
  - `media element error adds the sound id to snapshot.failed without throwing`
  - `stopAll clears both layers`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement two decks per track layer. Equal-power curves via `setValueCurveAtTime` with `Float32Array` of `cos`/`sin` over 64 samples; always `cancelScheduledValues(now)` and `setValueAtTime(currentValue, now)` before scheduling. Pause the outgoing element with a `setTimeout` of `CROSSFADE_SECONDS * 1000`, cancelled if that deck is reused. Set `crossOrigin = 'anonymous'`, `loop = true`, `preload = 'auto'`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: add crossfading music and ambience channels`.

---

### Task 5: Audio engine SFX

**Files:**
- Modify: `src/audio-engine/audio-engine.ts`
- Create: `src/audio-engine/browser-engine.ts`
- Test: `src/audio-engine/audio-engine.sfx.test.ts`

**Interfaces:**
- Produces: `preloadSfx(sounds: PlayableSound[]): Promise<void>`, `playSfx(sound: PlayableSound): Promise<void>`, `stopAllSfx(): void`; `getBrowserEngine(): AudioEngine` (lazy singleton with real browser deps; `storage` is `window.localStorage` guarded by try/catch).

- [ ] **Step 1: Write failing tests:**
  - `preloadSfx fetches and decodes each sound once`
  - `playSfx uses the cached buffer and starts a new buffer source on the sfx bus`
  - `playSfx on an uncached sound fetches lazily then plays`
  - `the same sfx played twice creates two overlapping sources`
  - `stopAllSfx stops every active source; ended sources are forgotten`
  - `fetch or decode failure adds the id to snapshot.failed and playSfx resolves without throwing`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Deduplicate concurrent loads of the same id with an in-flight promise map.
- [ ] **Step 4:** Run → PASS; `npm run build` still succeeds (`browser-engine.ts` must not touch `window` at import time).
- [ ] **Step 5:** Commit `feat: add sfx playback and browser engine factory`.

---

### Task 6: Audio sourcing pipeline and sound library content

**Files:**
- Create: `scripts/audio-sources.json`, `scripts/build-audio.mjs`, `public/audio/{music,ambience,sfx}/*.mp3`
- Modify: `src/sound-library/sounds.ts`, `package.json` (dev dep `ffmpeg-static`, script `"audio": "node scripts/build-audio.mjs"`)
- Test: `src/content-integrity/content.test.ts` (existing gate)

**Interfaces:**
- Consumes: `Sound`, `soundSrc` from Task 2.
- Produces: library sound ids listed below (Task 7 references them).

`audio-sources.json` entry: `{ "id", "kind", "origin": "download" | "generated", "url"?, "pageUrl"?, "maxSeconds"?, "filter"?, "recipe"? }`. `build-audio.mjs` downloads (or synthesizes with ffmpeg `lavfi`), trims to `maxSeconds`, applies optional extra `filter`, loudness-normalizes with `loudnorm` (music `I=-20`, ambience `I=-23`, sfx `I=-16`, all `TP=-1.5`), encodes MP3 (sfx 128 kbps mono, loops 128 kbps stereo), writes `public/audio/<kind>/<id>.mp3`. Idempotent: skips existing outputs unless `--force`.

**Sourcing rules:**
- Freesound: discover via `https://freesound.org/search/?q=<terms>&f=license%3A%22Creative+Commons+0%22`, open each candidate's sound page and confirm the CC0 deed link, download the `-hq.mp3` preview from `cdn.freesound.org`. Credit `{ source: 'freesound', license: 'CC0', author: <uploader>, url: <sound page> }`.
- Music: Incompetech (Kevin MacLeod, CC-BY-4.0). Verify each track page exists and the MP3 URL returns 200 before using it. Credit with track page URL.
- Period radio: a MacLeod 1920s-style/ragtime track (e.g. "Maple Leaf Rag") with filter `highpass=f=300,lowpass=f=3200` plus light noise for a radio feel.
- Generated: ffmpeg `lavfi` (`anoisesrc`, `sine`, filters). Credit `{ source: 'generated', license: 'generated', author: 'rpg-soundboard' }`.
- If no acceptable CC0 candidate exists for an id, generate it or drop it and remove its references; report every drop.

**Library ids** (`id` — Spanish title — kind — origin hint):

Music: `radio-epoca` Radio de época (jazz años 20) · `elegancia-inquietante` Elegancia inquietante · `misterio-investigacion` Misterio e investigación · `tension-oscura` Tensión oscura · `horror-ascendente` Horror ascendente · `combate-horror` Combate de horror · `calma-tras-horror` Calma tras el horror (all Incompetech) · `dron-abisal` Dron abisal · `trance-hipnotico` Trance hipnótico (generated).

Ambience: `costa-gaviotas` Costa con gaviotas · `burbujeo-acuario` Burbujeo de acuario · `tanque-submarino` Tanque de agua profundo · `sala-maquinas` Sala de máquinas · `goteo-cavidad` Goteo en una cavidad · `lluvia` Lluvia · `tormenta` Tormenta · `viento-nocturno` Viento nocturno (Freesound) · `zumbido-subterraneo` Zumbido subterráneo · `luces-emergencia` Zumbido de luces de emergencia (generated).

SFX (Freesound unless noted): `coche-grava` Coche llegando por grava · `puerta-coche` Puerta de coche · `montacargas` Montacargas · `verja-metalica` Verja metálica · `llaves` Llaves · `pasos-baldosa` Pasos en baldosa · `pasos-mojados` Pasos en suelo mojado · `pasos-pasarela` Pasos en pasarela metálica · `puerta-chirrido` Puerta que chirría · `portazo` Portazo · `apagon` Apagón · `generador-arranque` Generador arrancando · `generador-falla` Generador fallando · `chispazo` Chispazo eléctrico · `tuberia-revienta` Tubería que revienta · `chorro-agua` Chorro de agua · `crujido-metal` Crujido de metal · `cristal-estalla` Cristal que estalla · `grito-hombre` Grito de hombre · `grito-mujer` Grito de mujer · `salpicadura` Salpicadura · `zambullida` Algo cae al agua · `pez-coleteando` Pez coleteando · `cajon-secreto` Cajón secreto · `taquilla-metal` Taquilla metálica · `papeles` Hojear papeles · `revolver-tambor` Tambor de revólver · `disparo-revolver` Disparo de revólver · `disparo-arpon` Disparo de arpón · `palanca-compuerta` Palanca de compuerta · `golpes-compuerta` Golpes contra la compuerta · `canto-ballena` Canto de ballena · `morsa` Morsa · `chillido-inhumano` Chillido inhumano · `zarpazo` Zarpazo · `desague-remolino` Desagüe y remolino · `estatuilla-rompe` Estatuilla que se rompe · `latido` Latido · `susurros` Susurros · `trueno` Trueno · `aullido-lobo` Aullido de lobo · `sirena-lejana` Sirena lejana · `golpe-tension` Golpe de tensión · `perdida-estabilidad` Pérdida de Estabilidad · `destello-extrano` Destello extraño (the last three may be generated).

Every sound gets 2–5 Spanish `tags`.

- [ ] **Step 1:** Add `ffmpeg-static`; write `build-audio.mjs`; verify on two entries (one download, one generated) that outputs land in `public/audio/` and play (non-zero duration via `ffmpeg -i`).
- [ ] **Step 2:** Source all entries into `audio-sources.json`; run `npm run audio`.
- [ ] **Step 3:** Check sizes: every SFX < 300 KB; loops between 120 and 300 s.
- [ ] **Step 4:** Fill `sounds.ts` with one `Sound` per output file.
- [ ] **Step 5:** `npm test` → PASS (integrity gate green).
- [ ] **Step 6:** Commit `feat: add sourced and generated sound library` (split into two commits if the diff is unwieldy: pipeline, then content).

---

### Task 7: Adventure *La última inspección*

**Files:**
- Create: `src/adventures/la-ultima-inspeccion.ts`
- Modify: `src/adventures/index.ts`
- Test: `src/content-integrity/content.test.ts` (existing gate)

**Interfaces:**
- Consumes: library ids from Task 6.
- Produces: `adventures` contains `{ id: 'la-ultima-inspeccion', title: 'La última inspección en el acuario', system: 'el-rastro-de-cthulhu', ... }`.

Scene plan (music / ambience / curated SFX / cues). Cues are short GM prompts in Spanish; never copy adventure text.

1. `llegada-montacargas` "Llegada y montacargas" — `radio-epoca` / `costa-gaviotas` / coche-grava, puerta-coche, llaves, verja-metalica, montacargas, pasos-baldosa. Cues: llegada en limusina → coche-grava; bajada al acuario → montacargas.
2. `hall-exposicion` "El hall y la exposición" — `elegancia-inquietante` / `burbujeo-acuario` / pasos-baldosa, puerta-chirrido, pez-coleteando, latido.
3. `visita-guiada` "Visita guiada" — `misterio-investigacion` / `tanque-submarino` / canto-ballena, pasos-pasarela, puerta-chirrido, apagon, chorro-agua. Cue: el apagón → apagon + golpe-tension (then GM switches to scene 4).
4. `sala-generador` "Sala del generador" — no music / `sala-maquinas` / generador-falla, chispazo, tuberia-revienta, chorro-agua, crujido-metal. Cue: la tubería rota desde dentro → crujido-metal.
5. `muerte-en-el-hall` "Muerte en el hall" — `tension-oscura` / `luces-emergencia` / cristal-estalla, grito-hombre, salpicadura, pez-coleteando, pasos-mojados, latido. Cues: antes de que lleguen al hall → cristal-estalla + grito-hombre; al descubrir el cuerpo → golpe-tension.
6. `investigacion` "Investigación en las salas" — `misterio-investigacion` / `luces-emergencia` / taquilla-metal, cajon-secreto, papeles, revolver-tambor, palanca-compuerta, pasos-mojados. Cue: todos los peces se giran a mirarlos → susurros.
7. `pasarelas-tanques` "Pasarelas sobre los tanques" — `dron-abisal` / `tanque-submarino` / pasos-pasarela, zambullida, canto-ballena, morsa, salpicadura. Cue: el destello lila y las tres siluetas → destello-extrano + latido.
8. `enfrentamiento-final` "Enfrentamiento final" — `combate-horror` / `tanque-submarino` / chillido-inhumano, zarpazo, zambullida, disparo-revolver, disparo-arpon, desague-remolino, golpes-compuerta, grito-mujer, estatuilla-rompe. Cues: aparecen las criaturas → chillido-inhumano; arrastran a Cindy bajo el agua → grito-mujer + zambullida; mirar la estatuilla → música `trance-hipnotico` (cue soundIds: ['trance-hipnotico']); la estatuilla se rompe → estatuilla-rompe + golpe-tension.
9. `resolucion` "Resolución" — `calma-tras-horror` / `goteo-cavidad` / generador-arranque, montacargas, sirena-lejana. Cues: vuelve la luz → generador-arranque; salen al exterior → `costa-gaviotas` (ambience switch).

Add `perdida-estabilidad` to the SFX of scenes 5, 7 and 8. A cue whose `soundIds` contain music/ambience switches that layer (handled in Task 8).

- [ ] **Step 1:** Write the adventure file and register it.
- [ ] **Step 2:** `npm test` → PASS. Fix any reference the integrity gate reports (e.g. dropped ids from Task 6).
- [ ] **Step 3:** Commit `feat: add la ultima inspeccion adventure`.

---

### Task 8: Soundboard UI — home, scenes, cues, SFX, mixer, silence, unlock

Use the `frontend-design` skill for visual direction before writing components: dark low-light theme, 1930s display typography for titles (via `next/font`), high contrast, no distracting animation.

**Files:**
- Create: `src/soundboard/use-audio-engine.ts`, `src/soundboard/use-wake-lock.ts`, `src/soundboard/fire-cue.ts`, `src/soundboard/soundboard.tsx`, `src/soundboard/scene-list.tsx`, `src/soundboard/scene-panel.tsx`, `src/soundboard/sound-button.tsx`, `src/soundboard/mixer.tsx`, `src/soundboard/transport-bar.tsx` (SILENCIO / Reanudar / Cortar efectos), `src/soundboard/unlock-overlay.tsx`, `src/soundboard/toast.tsx`, `src/app/partidas/[id]/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, global CSS
- Test: `src/soundboard/fire-cue.test.ts`, `src/soundboard/soundboard.test.tsx`

**Interfaces:**
- Consumes: `getBrowserEngine`, `AudioEngine` methods, `getSound`, `adventures`, `getAdventure`.
- Produces: `useAudioEngine(): { engine: AudioEngine; snapshot: EngineSnapshot }` (via `useSyncExternalStore`, server snapshot = locked defaults); `fireCue(engine: AudioEngine, cue: SceneCue, lookup: (id: string) => Sound | undefined): void` — sfx → `playSfx`, music/ambience → `setTrack(kind, sound)`; `<Soundboard adventure={Adventure} />` client component.

Behavior:
- `/partidas/[id]`: `generateStaticParams` from `adventures`, `dynamicParams = false`, unknown id → `notFound()`. Page renders `<Soundboard>`.
- On mount: `preloadSfx` for every sfx in the adventure; on unmount `stopAll()`.
- Selecting a scene calls `setTrack('music', …)` and `setTrack('ambience', …)` (undefined when absent).
- Buttons whose id is in `snapshot.failed` render a disabled error state; a toast "No se pudo cargar: <título>" appears once per failed id.
- `UnlockOverlay` visible while `!snapshot.unlocked`; text "Toca para activar el sonido" and hint "Si usas un iPad, comprueba que el interruptor de silencio esté desactivado". Tap calls `engine.unlock()`.
- `useWakeLock(active: boolean)` requests `navigator.wakeLock` when available, re-requests on `visibilitychange`, silently no-ops otherwise.
- Home: one card per adventure linking to `/partidas/<id>`, plus a footer link to `/creditos`.

- [ ] **Step 1: Write failing tests:**
  - `fire-cue.test.ts`: `fires sfx via playSfx`, `switches music and ambience via setTrack`, `skips unknown ids`.
  - `soundboard.test.tsx` (engine mocked via `vi.mock('@/audio-engine/browser-engine')`): `shows unlock overlay until unlocked`, `selecting a scene sets its music and ambience`, `renders cues and fires them on tap`, `silence button toggles to Reanudar`, `failed sound button is disabled`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement hooks and components.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` → all green.
- [ ] **Step 5:** Commit `feat: add soundboard ui with scenes, cues, mixer and silence`.

---

### Task 9: Library drawer and credits page

**Files:**
- Create: `src/sound-library/search-sounds.ts`, `src/soundboard/library-drawer.tsx`, `src/app/creditos/page.tsx`
- Modify: `src/soundboard/soundboard.tsx`
- Test: `src/sound-library/search-sounds.test.ts`, `src/soundboard/library-drawer.test.tsx`

**Interfaces:**
- Produces: `searchSounds(sounds: Sound[], query: string, kind?: SoundKind): Sound[]` — normalizes with NFD + diacritic strip + lowercase; every whitespace-separated term must match the title or a tag; empty query returns all (filtered by kind); results sorted by title with `localeCompare(…, 'es')`.

- [ ] **Step 1: Write failing tests:**
  - `matches title case- and accent-insensitively` ("CRISTAL" and "crístal" → `cristal-estalla`) (Review Focus 5)
  - `matches tags`, `requires all terms`, `filters by kind`, `empty query returns all sorted`
  - `library-drawer.test.tsx`: `tapping an sfx result plays it`, `tapping a music result sets the music track without changing the active scene`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `searchSounds`, the drawer (kind filter chips: Todo / Música / Ambiente / Efectos, search input, result buttons), and `/creditos` listing every sound grouped by kind with title, author, license and source link. Kevin MacLeod tracks credited in the CC-BY form: `"<Title>" Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0`.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` → green.
- [ ] **Step 5:** Commit `feat: add library search drawer and credits page`.

---

### Task 10: Manual smoke test and deploy

**Files:**
- Create: `README.md` (what it is, `npm run dev`, how content is added — spec §10, `npm run audio`)

- [ ] **Step 1:** Run the app in a browser preview. Verify: unlock overlay → tap → scene 1 music + ambience audible; switching scenes crossfades; SFX and cue buttons play; sliders change volume; SILENCIO fades out and Reanudar restores; library search finds "cristal"; `/creditos` lists every sound; layout works at phone (375 px), tablet (768 px) and desktop widths. No console errors.
- [ ] **Step 2:** `npm test && npm run lint && npm run build` → green.
- [ ] **Step 3:** Commit `docs: add readme`.
- [ ] **Step 4:** Deploy to Vercel (user logs in; use `deploy-to-vercel` skill). Verify the production URL loads, `/partidas/la-ultima-inspeccion` plays audio on a real iPad.
