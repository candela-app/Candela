import { APPLAUSE_LEAD_IN_SEC } from '@candela/shared/rn';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

const applauseModule = require('@candela/shared/assets/sfx/applause-cheer.mp3') as number;

type ToneKind = 'sine' | 'sawtooth' | 'triangle';

const cache: Partial<Record<string, string>> = {};
let audioReady = false;

async function ensureAudioMode() {
  if (audioReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'duckOthers',
  });
  audioReady = true;
}

function waveSample(kind: ToneKind, phase: number) {
  const cycle = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  if (kind === 'sawtooth') return 2 * cycle - 1;
  if (kind === 'triangle') return 4 * Math.abs(cycle - 0.5) - 1;
  return Math.sin(phase);
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[triple & 63] : '=';
  }
  return out;
}

function encodeWavSweep(options: {
  startHz: number;
  endHz: number;
  durationMs: number;
  kind: ToneKind;
  gain?: number;
}) {
  const sampleRate = 22050;
  const n = Math.max(2, Math.floor(sampleRate * (options.durationMs / 1000)));
  const samples = new Int16Array(n);
  const peak = Math.floor(32767 * (options.gain ?? 0.28));
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const hz = options.startHz + (options.endHz - options.startHz) * t;
    phase += (Math.PI * 2 * hz) / sampleRate;
    const env = Math.exp(-3.2 * t);
    samples[i] = Math.max(-32767, Math.min(32767, waveSample(options.kind, phase) * peak * env));
  }

  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  return bytesToBase64(bytes);
}

function encodeWavWhoosh(options?: { durationMs?: number; gain?: number }) {
  const sampleRate = 22050;
  const durationMs = options?.durationMs ?? 180;
  const n = Math.max(2, Math.floor(sampleRate * (durationMs / 1000)));
  const samples = new Int16Array(n);
  const peak = Math.floor(32767 * (options?.gain ?? 0.28));
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const envelope = Math.pow(1 - t, 1.6);
    // Approximate bandpass noise: high-pass-ish by differencing successive random samples
    const noise = Math.random() * 2 - 1;
    const bright = noise * (0.55 + 0.45 * (1 - t));
    samples[i] = Math.max(-32767, Math.min(32767, bright * peak * envelope));
  }

  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  return bytesToBase64(bytes);
}

function encodeWavFromSamples(samples: Int16Array) {
  const sampleRate = 22050;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }
  return bytesToBase64(new Uint8Array(buffer));
}

function encodePartyBlast() {
  const sampleRate = 22050;
  const n = Math.floor(sampleRate * 0.32);
  const samples = new Int16Array(n);
  const peak = Math.floor(32767 * 0.44);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const env = Math.pow(1 - t, 2.2);
    const noise = (Math.random() * 2 - 1) * env;
    phase += (Math.PI * 2 * (98 - 56 * t)) / sampleRate;
    const boom = Math.sin(phase) * env * 0.72;
    samples[i] = Math.max(-32767, Math.min(32767, (noise * 0.62 + boom) * peak));
  }
  return encodeWavFromSamples(samples);
}

async function fileFor(name: string, builder: () => string) {
  if (cache[name]) return cache[name]!;
  const path = `${FileSystem.cacheDirectory}candela-${name}.wav`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(path, builder(), { encoding: FileSystem.EncodingType.Base64 });
  }
  cache[name] = path;
  return path;
}

function releasePlayer(player: AudioPlayer) {
  try {
    player.pause();
    player.remove();
  } catch {
    // ignore
  }
}

async function playFile(path: string, volume = 0.85) {
  await ensureAudioMode();
  const player = createAudioPlayer({ uri: path });
  player.volume = volume;
  const sub = player.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish) return;
    sub.remove();
    releasePlayer(player);
  });
  player.play();
}

export async function playCorrectWoosh() {
  try {
    const path = await fileFor('correct-svi-whoosh-v1', () => encodeWavWhoosh({ durationMs: 180, gain: 0.3 }));
    await playFile(path);
  } catch {
    // audio is optional on simulators
  }
}

export async function playMoveWhoosh() {
  try {
    const path = await fileFor('svi-move-whoosh-v1', () => encodeWavWhoosh({ durationMs: 100, gain: 0.26 }));
    await playFile(path);
  } catch {
    // audio is optional on simulators
  }
}

export async function preloadMoveWhoosh() {
  try {
    await ensureAudioMode();
    await fileFor('svi-move-whoosh-v1', () => encodeWavWhoosh({ durationMs: 100, gain: 0.26 }));
  } catch {
    // audio is optional on simulators
  }
}

export async function playWrongWoosh() {
  try {
    const path = await fileFor('wrong', () =>
      encodeWavSweep({ startHz: 320, endHz: 180, durationMs: 250, kind: 'sawtooth', gain: 0.34 }),
    );
    await playFile(path);
  } catch {
    // audio is optional on simulators
  }
}

export async function playOpenTap() {
  try {
    const path = await fileFor('open-tap', () =>
      encodeWavSweep({ startHz: 620, endHz: 280, durationMs: 90, kind: 'triangle', gain: 0.24 }),
    );
    await playFile(path);
  } catch {
    // audio is optional on simulators
  }
}

export async function playMissThud() {
  try {
    const path = await fileFor('miss', () =>
      encodeWavSweep({ startHz: 150, endHz: 65, durationMs: 200, kind: 'triangle', gain: 0.4 }),
    );
    await playFile(path);
  } catch {
    // audio is optional on simulators
  }
}

export async function playPartyBlast() {
  try {
    const path = await fileFor('party-blast-v1', encodePartyBlast);
    await playFile(path);
  } catch {
    // audio is optional on simulators
  }
}

let clapPlayer: AudioPlayer | null = null;

export function stopClapBed() {
  if (!clapPlayer) return;
  releasePlayer(clapPlayer);
  clapPlayer = null;
}

export async function playClapBed() {
  try {
    await ensureAudioMode();
    stopClapBed();
    const asset = Asset.fromModule(applauseModule);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    const player = asset.localUri
      ? createAudioPlayer({ uri: asset.localUri })
      : createAudioPlayer(applauseModule);
    player.volume = 0.9;
    clapPlayer = player;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      sub.remove();
      if (clapPlayer === player) {
        releasePlayer(player);
        clapPlayer = null;
      }
    });
    try {
      await player.seekTo(APPLAUSE_LEAD_IN_SEC);
    } catch {
      // play from the start if seek is not ready
    }
    player.play();
  } catch {
    // audio is optional on simulators
  }
}

export async function preloadClapBed() {
  try {
    await ensureAudioMode();
    await Asset.fromModule(applauseModule).downloadAsync();
  } catch {
    // audio is optional on simulators
  }
}

export async function playMetronomeTick() {
  try {
    const path = await fileFor('metro', () =>
      encodeWavSweep({ startHz: 1000, endHz: 1000, durationMs: 40, kind: 'triangle', gain: 0.18 }),
    );
    await playFile(path);
  } catch {
    // audio is optional on simulators
  }
}

const JOIN_POOL_SIZE = 3;
let joinPool: AudioPlayer[] = [];
let joinPoolReady: Promise<AudioPlayer[]> | null = null;
let joinCursor = 0;

async function loadJoinPool() {
  if (joinPool.length >= JOIN_POOL_SIZE) return joinPool;
  await ensureAudioMode();
  const path = await fileFor('dotjoin-v2', () =>
    encodeWavSweep({ startHz: 988, endHz: 1318, durationMs: 160, kind: 'sine', gain: 0.4 }),
  );
  while (joinPool.length < JOIN_POOL_SIZE) {
    const player = createAudioPlayer({ uri: path });
    player.volume = 1;
    joinPool.push(player);
  }
  return joinPool;
}

function ensureJoinPool() {
  if (!joinPoolReady) {
    joinPoolReady = loadJoinPool().catch((err) => {
      joinPoolReady = null;
      throw err;
    });
  }
  return joinPoolReady;
}

export async function preloadDotJoin() {
  try {
    await ensureJoinPool();
  } catch {
    // audio is optional on simulators
  }
}

export async function playDotJoin() {
  try {
    const pool = await ensureJoinPool();
    if (pool.length === 0) return;
    const player = pool[joinCursor % pool.length];
    joinCursor += 1;
    if (!player.isLoaded) {
      joinPool.forEach(releasePlayer);
      joinPool = [];
      joinPoolReady = null;
      const retry = await ensureJoinPool();
      const next = retry[0];
      if (!next) return;
      await next.seekTo(0);
      next.play();
      return;
    }
    if (player.playing) {
      player.pause();
    }
    await player.seekTo(0);
    player.play();
  } catch {
    joinPool.forEach(releasePlayer);
    joinPool = [];
    joinPoolReady = null;
  }
}

function encodeBeeBuzzLoop() {
  const sampleRate = 22050;
  const n = Math.floor(sampleRate * 0.45);
  const samples = new Int16Array(n);
  const peak = Math.floor(32767 * 0.16);
  let phase = 0;
  let wingPhase = 0;
  for (let i = 0; i < n; i += 1) {
    const wing = 0.55 + 0.45 * Math.sin(wingPhase);
    phase += (Math.PI * 2 * (148 + 12 * Math.sin(wingPhase * 0.35))) / sampleRate;
    wingPhase += (Math.PI * 2 * 32) / sampleRate;
    const buzz = waveSample('sawtooth', phase) * 0.55 + waveSample('sine', phase * 2.05) * 0.45;
    samples[i] = Math.max(-32767, Math.min(32767, buzz * wing * peak));
  }

  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }
  return bytesToBase64(new Uint8Array(buffer));
}

let beeBuzzSound: AudioPlayer | null = null;
let beeBuzzStarting = false;
let beeBuzzGeneration = 0;

export async function startBeeBuzz() {
  if (beeBuzzSound || beeBuzzStarting) return;
  beeBuzzStarting = true;
  const generation = beeBuzzGeneration;
  try {
    await ensureAudioMode();
    if (generation !== beeBuzzGeneration) return;
    const path = await fileFor('bee-buzz', encodeBeeBuzzLoop);
    if (generation !== beeBuzzGeneration) return;
    const player = createAudioPlayer({ uri: path });
    player.loop = true;
    player.volume = 0.55;
    if (generation !== beeBuzzGeneration) {
      releasePlayer(player);
      return;
    }
    player.play();
    beeBuzzSound = player;
  } catch {
    // audio is optional on simulators
  } finally {
    if (generation === beeBuzzGeneration) beeBuzzStarting = false;
  }
}

export async function stopBeeBuzz() {
  beeBuzzGeneration += 1;
  beeBuzzStarting = false;
  const player = beeBuzzSound;
  beeBuzzSound = null;
  if (!player) return;
  releasePlayer(player);
}
