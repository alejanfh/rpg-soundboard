#!/usr/bin/env node
/**
 * Builds the sound library audio files from scripts/audio-sources.json.
 *
 *   npm run audio                 build every missing file
 *   npm run audio -- --force      rebuild everything
 *   npm run audio -- --only a,b   build only the listed ids
 *   npm run audio -- --kind sfx   build only one kind (music, ambience or sfx)
 *
 * Downloads are cached in scripts/.cache (git-ignored). Outputs go to
 * public/audio/<kind>/<id>.mp3: trimmed, loudness-normalized (two-pass
 * loudnorm) and encoded at 128 kbps (sfx mono, music/ambience stereo).
 *
 * Manifest entry fields:
 *   id, kind (music|ambience|sfx), origin (download|generated)
 *   source, author, license, licenseUrl   credit metadata (mirrored in sounds.ts)
 *   url, pageUrl, sourceTitle             download entries: file URL, sound/track page
 *   startSeconds, maxSeconds              trim window (music/ambience default max 300 s)
 *   filter, noise                         extra ffmpeg filter / pink-noise amplitude to mix in
 *   loop                                  force (true) or skip (false) the seamless loop seam;
 *                                         defaults to true for ambience and generated sounds
 *   recipe                                generated entries: lavfi `inputs` and a `graph`
 *                                         that ends in the `[mix]` label, plus `duration`
 *
 * Loops (ambience, generated music) get their last 3 s blended into their first 3 s, so they
 * wrap around without a click; loops shorter than 120 s are repeated up to ~130 s.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "scripts", "audio-sources.json");
const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const OUT_DIR = path.join(ROOT, "public", "audio");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const DOWNLOAD_DELAY_MS = 700;
const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 240_000;

const SAMPLE_RATE = 44100;
const MIN_LOOP_SECONDS = 120;
const MAX_LOOP_SECONDS = 300;
/** Loops shorter than the minimum are repeated up to this length. */
const EXTEND_TARGET_SECONDS = 130;
const SEAM_SECONDS = 3;
const TRIM_FADE_SECONDS = { sfx: 0.3, ambience: 2, music: 2 };

/** loudnorm integrated-loudness targets (LUFS) per kind; true peak is shared. */
const LOUDNESS = { music: -20, ambience: -23, sfx: -16 };
const TRUE_PEAK = -1.5;
/**
 * Short transient sounds (slams, shots, steps) cannot reach their integrated target without
 * exceeding the true-peak ceiling, so loudnorm leaves them far too quiet. SFX instead get a
 * gentle compressor, then a measured gain plus a peak limiter that may work this hard (dB).
 */
const MAX_LIMITING_DB = 12;
const SFX_COMPRESSOR = "acompressor=threshold=0.02:ratio=4:attack=3:release=60:makeup=1";
/** SFX quieter than this after normalization are reported as peak-normalized. */
const SFX_FLOOR_LUFS = -20;
/** Below this the integrated loudness is just the gate floor, i.e. not really measurable. */
const UNMEASURABLE_LUFS = -69;
/** The limiter works on sample peaks, so it stops this far below the true-peak target; MP3 overshoot is corrected after encoding. */
const LIMITER_MARGIN_DB = 0.3;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  fail(
    "the ffmpeg-static binary is missing. Run `node node_modules/ffmpeg-static/install.js` and retry.",
  );
}

function runFfmpeg(args) {
  const result = spawnSync(ffmpegPath, ["-hide_banner", "-nostdin", ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status: result.status, stderr: result.stderr ?? "" };
}

function probe(file) {
  const { stderr } = runFfmpeg(["-i", file]);
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!match) fail(`could not read the duration of ${file}`);
  return {
    duration: Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]),
    stereo: /Audio:[^\n]*\bstereo\b/.test(stderr),
  };
}

const probeDuration = (file) => probe(file).duration;

function meanVolume(file, window, panFilter) {
  const { stderr } = runFfmpeg([...window, "-i", file, "-af", `${panFilter},volumedetect`, "-f", "null", "-"]);
  const match = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  return match ? Number(match[1]) : -Infinity;
}

/**
 * Mono downmix for SFX. Averaging the channels is the default, but some stereo sources are
 * out of phase and the average cancels to silence, so fall back to the left channel then.
 */
function monoDownmix(file, window) {
  const average = "pan=mono|c0=0.5*c0+0.5*c1";
  const left = "pan=mono|c0=c0";
  if (meanVolume(file, window, average) >= meanVolume(file, window, left) - 4) return average;
  console.log("  note: channels are out of phase, using the left channel only");
  return left;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(entry) {
  const ext = path.extname(new URL(entry.url).pathname) || ".mp3";
  const dest = path.join(CACHE_DIR, `${entry.id}${ext}`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`  downloading ${entry.url}`);
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(entry.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok) fail(`download of ${entry.id} failed with HTTP ${response.status}`);
      fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
      await sleep(DOWNLOAD_DELAY_MS);
      return dest;
    } catch (error) {
      console.log(`  attempt ${attempt} failed: ${error.message}`);
    }
  }
  return fail(`download of ${entry.id} failed after ${DOWNLOAD_ATTEMPTS} attempts`);
}

const round = (value) => Math.round(value * 1000) / 1000;

/** Repeats a seamless loop back to back until it lasts at least `target` seconds. */
function repeatLoop(input, length, target) {
  const copies = Math.ceil(target / length);
  const labels = Array.from({ length: copies }, (_, i) => `[rep${i}]`);
  return {
    parts: [
      `${input}asplit=${copies}${labels.join("")}`,
      `${labels.join("")}concat=n=${copies}:v=0:a=1[repeated]`,
    ],
    label: "[repeated]",
    length: copies * length,
  };
}

/**
 * Makes a clip loop without a click: the last SEAM seconds are blended into the
 * first SEAM seconds, so the end flows straight back into the start.
 */
function makeSeamless(input, length) {
  const t = Math.min(SEAM_SECONDS, length / 4);
  const parts = [
    `${input}asplit=3[sa][sb][sc]`,
    `[sa]atrim=start=${round(length - t)}:end=${round(length)},asetpts=PTS-STARTPTS,afade=t=out:d=${round(t)}:curve=qsin[stail]`,
    `[sb]atrim=start=0:end=${round(t)},asetpts=PTS-STARTPTS,afade=t=in:d=${round(t)}:curve=qsin[shead]`,
    `[stail][shead]amix=inputs=2:duration=longest:normalize=0[sblend]`,
    `[sc]atrim=start=${round(t)}:end=${round(length - t)},asetpts=PTS-STARTPTS[smid]`,
    `[sblend][smid]concat=n=2:v=0:a=1[seamless]`,
  ];
  return { parts, label: "[seamless]", length: length - t };
}

/** Builds the ffmpeg input args and the filter graph (ending at `label`) for one entry. */
function plan(entry, sourceFile) {
  const sfx = entry.kind === "sfx";
  const layout = sfx ? "mono" : "stereo";
  const loop = entry.loop ?? (entry.kind === "ambience" || entry.origin === "generated");
  const inputArgs = [];
  const parts = [];
  let label;
  let length;
  let trimmed = false;

  if (entry.origin === "generated") {
    const { duration, inputs, graph } = entry.recipe;
    for (const source of inputs) inputArgs.push("-f", "lavfi", "-t", String(duration), "-i", source);
    parts.push(graph);
    parts.push(`[mix]aresample=osr=${SAMPLE_RATE}:ochl=${layout}[base]`);
    label = "[base]";
    length = duration;
  } else {
    const start = entry.startSeconds ?? 0;
    const info = probe(sourceFile);
    const sourceLength = info.duration - start;
    const cap = entry.maxSeconds ?? (sfx ? Infinity : MAX_LOOP_SECONDS);
    const window = start > 0 ? ["-ss", String(start)] : [];
    inputArgs.push(...window, "-i", sourceFile);
    const downmix = sfx && info.stereo ? `${monoDownmix(sourceFile, window)},` : "";
    parts.push(`[0:a]${downmix}aresample=osr=${SAMPLE_RATE}:ochl=${layout}[base]`);
    label = "[base]";
    length = Math.min(sourceLength, cap);
    trimmed = cap < sourceLength - 0.05;
    if (sfx) {
      parts.push(`${label}silenceremove=start_periods=1:start_threshold=-50dB[sr]`);
      label = "[sr]";
    }
    if (Number.isFinite(cap)) {
      parts.push(`${label}atrim=end=${round(cap)},asetpts=PTS-STARTPTS[cut]`);
      label = "[cut]";
    }
  }

  if (entry.noise) {
    const noiseIndex = inputArgs.filter((arg) => arg === "-i").length;
    inputArgs.push(
      "-f",
      "lavfi",
      "-t",
      String(round(length + 1)),
      "-i",
      `anoisesrc=c=pink:a=${entry.noise}:r=${SAMPLE_RATE}`,
    );
    parts.push(
      `[${noiseIndex}:a]aresample=ochl=${layout}[noise]`,
      `${label}[noise]amix=inputs=2:duration=first:normalize=0[noisy]`,
    );
    label = "[noisy]";
  }

  if (loop) {
    const seamless = makeSeamless(label, length);
    parts.push(...seamless.parts);
    label = seamless.label;
    length = seamless.length;
    if (length < MIN_LOOP_SECONDS) {
      const repeated = repeatLoop(label, length, EXTEND_TARGET_SECONDS);
      parts.push(...repeated.parts);
      label = repeated.label;
      length = repeated.length;
    }
  }

  if (entry.filter) {
    parts.push(`${label}${entry.filter}[filtered]`);
    label = "[filtered]";
  }

  if (trimmed && !loop) {
    const fade = TRIM_FADE_SECONDS[entry.kind];
    parts.push(`${label}afade=t=out:st=${round(Math.max(0, length - fade))}:d=${fade}[faded]`);
    label = "[faded]";
  }

  if (sfx) {
    parts.push(`${label}${SFX_COMPRESSOR}[compressed]`);
    label = "[compressed]";
  }

  return { inputArgs, graph: parts.join(";"), label, layout, length };
}

function loudnormFilter(kind, measured) {
  const base = `loudnorm=I=${LOUDNESS[kind]}:TP=${TRUE_PEAK}:LRA=50`;
  if (!measured) return `${base}:print_format=json`;
  return (
    `${base}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
    `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
    `:offset=${measured.target_offset}:linear=true`
  );
}

/**
 * SFX gain stage: gain towards the loudness target, limited so the limiter never works harder
 * than MAX_LIMITING_DB. When the loudness cannot be measured (clips under ~0.4 s) the clip is
 * peak-normalized to the true-peak target instead. Returns the filter and how it was chosen.
 */
function sfxGainFilter(stats) {
  const limit = TRUE_PEAK - LIMITER_MARGIN_DB;
  const limiter = `alimiter=limit=${round(10 ** (limit / 20))}:level=disabled`;
  if (!Number.isFinite(stats.lufs) || stats.lufs <= UNMEASURABLE_LUFS) {
    const gain = TRUE_PEAK - 0.3 - stats.peak;
    return { filter: `volume=${round(gain)}dB`, mode: "peak-normalized (loudness unmeasurable)" };
  }
  const wanted = LOUDNESS.sfx - stats.lufs;
  const headroom = limit - stats.peak + MAX_LIMITING_DB;
  const gain = Math.min(wanted, headroom);
  const mode = gain < wanted ? "limited by peak headroom" : "on target";
  return { filter: `volume=${round(gain)}dB,${limiter}`, mode };
}

function parseLoudnormJson(stderr) {
  const match = /\{[^{}]*"input_i"[^{}]*\}/.exec(stderr);
  if (!match) return null;
  const data = JSON.parse(match[0]);
  return Number.isFinite(Number(data.input_i)) ? data : null;
}

/** Reads the integrated loudness and true peak from an ebur128=peak=true summary. */
function parseEbur128(stderr) {
  const summary = stderr.split("Summary:")[1] ?? "";
  const integrated = /I:\s+(-?[\d.]+) LUFS/.exec(summary);
  const peak = /Peak:\s+(-?[\d.]+) dBFS/.exec(summary);
  return { lufs: integrated ? Number(integrated[1]) : NaN, peak: peak ? Number(peak[1]) : NaN };
}

function measureOutput(file) {
  const { stderr } = runFfmpeg(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  return parseEbur128(stderr);
}

async function buildEntry(entry) {
  const sfx = entry.kind === "sfx";
  const output = path.join(OUT_DIR, entry.kind, `${entry.id}.mp3`);
  const sourceFile = entry.origin === "download" ? await download(entry) : null;
  const { inputArgs, graph, label, layout } = plan(entry, sourceFile);

  const run = (audioFilter, outputArgs) =>
    runFfmpeg([
      "-y",
      ...inputArgs,
      "-filter_complex",
      `${graph};${label}${audioFilter}[out]`,
      "-map",
      "[out]",
      ...outputArgs,
    ]);

  // Pass 1: measure. SFX use ebur128 (loudness + true peak, also for very short clips);
  // music and ambience use loudnorm's own measurement.
  const measure = run(sfx ? "ebur128=peak=true" : loudnormFilter(entry.kind), ["-f", "null", "-"]);
  if (measure.status !== 0) fail(`ffmpeg failed measuring ${entry.id}:\n${measure.stderr.slice(-2000)}`);

  let gainStage;
  if (sfx) {
    const stats = parseEbur128(measure.stderr);
    const result = sfxGainFilter(stats);
    gainStage = result.filter;
    console.log(`  measured ${stats.lufs} LUFS, ${stats.peak} dBFS peak -> ${result.mode}`);
  } else {
    const measured = parseLoudnormJson(measure.stderr);
    if (!measured) fail(`${entry.id}: could not measure loudness (is the clip silent?)`);
    gainStage = loudnormFilter(entry.kind, measured);
  }

  // Encode to a temp file and rename on success, so an interrupted run never leaves a
  // partial MP3 behind for the skip-if-exists check to trust.
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const temp = path.join(CACHE_DIR, `out-${entry.kind}-${entry.id}.mp3`);
  const encode = (attenuationDb) => {
    const attenuate = attenuationDb > 0 ? `,volume=-${round(attenuationDb)}dB` : "";
    return run(`${gainStage}${attenuate}`, [
      "-map_metadata",
      "-1",
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      layout === "mono" ? "1" : "2",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      "-f",
      "mp3",
      temp,
    ]);
  };

  let attenuation = 0;
  let stats;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = encode(attenuation);
    if (result.status !== 0) fail(`ffmpeg failed encoding ${entry.id}:\n${result.stderr.slice(-2000)}`);
    stats = measureOutput(temp);
    // MP3 encoding can overshoot the limiter; back off until the true peak is under target.
    if (!(stats.peak > TRUE_PEAK)) break;
    attenuation += stats.peak - TRUE_PEAK + 0.2;
  }

  if (sfx && stats.lufs < SFX_FLOOR_LUFS) {
    console.log(`  note: impulsive, ${stats.lufs} LUFS is under ${SFX_FLOOR_LUFS}; peak-normalized to ${stats.peak} dBTP instead`);
  }
  fs.renameSync(temp, output);
  const kb = Math.round(fs.statSync(output).size / 1024);
  console.log(
    `  -> ${path.relative(ROOT, output)}  ${probeDuration(output).toFixed(1)}s  ${kb} KB  ${stats.lufs} LUFS  ${stats.peak} dBFS peak`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? new Set(args[onlyIndex + 1].split(",")) : null;
  const kindIndex = args.indexOf("--kind");
  const kind = kindIndex >= 0 ? args[kindIndex + 1] : null;

  const entries = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  let built = 0;
  for (const entry of entries) {
    if (only && !only.has(entry.id)) continue;
    if (kind && entry.kind !== kind) continue;
    const output = path.join(OUT_DIR, entry.kind, `${entry.id}.mp3`);
    if (!force && fs.existsSync(output)) {
      console.log(`skip ${entry.kind}/${entry.id} (exists)`);
      continue;
    }
    console.log(`build ${entry.kind}/${entry.id}`);
    await buildEntry(entry);
    built++;
  }
  console.log(`done: ${built} built of ${entries.length} entries`);
}

await main();
