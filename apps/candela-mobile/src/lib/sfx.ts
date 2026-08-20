import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

type ToneKind = 'sine' | 'sawtooth' | 'triangle';

const cache: Partial<Record<string, string>> = {};
let audioReady = false;

async function ensureAudioMode() {
  if (audioReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
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

async function playFile(path: string) {
  await ensureAudioMode();
  const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true, volume: 0.85 });
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded || !status.didJustFinish) return;
    void sound.unloadAsync();
  });
}

export async function playCorrectWoosh() {
  try {
    const path = await fileFor('correct', () =>
      encodeWavSweep({ startHz: 987, endHz: 1318, durationMs: 250, kind: 'sine', gain: 0.32 }),
    );
    await playFile(path);
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

export async function playDotJoin() {
  try {
    const path = await fileFor('dotjoin', () =>
      encodeWavSweep({ startHz: 1320, endHz: 1480, durationMs: 55, kind: 'sine', gain: 0.28 }),
    );
    await playFile(path);
  } catch {
    // audio is optional on simulators
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

let beeBuzzSound: Audio.Sound | null = null;
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
    const { sound } = await Audio.Sound.createAsync(
      { uri: path },
      { shouldPlay: true, isLooping: true, volume: 0.55 },
    );
    if (generation !== beeBuzzGeneration) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // ignore
      }
      return;
    }
    beeBuzzSound = sound;
  } catch {
    // audio is optional on simulators
  } finally {
    if (generation === beeBuzzGeneration) beeBuzzStarting = false;
  }
}

export async function stopBeeBuzz() {
  beeBuzzGeneration += 1;
  beeBuzzStarting = false;
  const sound = beeBuzzSound;
  beeBuzzSound = null;
  if (!sound) return;
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch {
    // ignore
  }
}
