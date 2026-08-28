/** Sample-accurate hand-clap model (double palm slap + resonances). */

function biquadBandpass(sampleRate: number, freq: number, q: number) {
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x: number) => {
    const y = (b0 / a0) * x + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One hand clap: two slightly offset slaps (palms), a mid “flesh” body,
 * a high crack, and a short room tail.
 */
export function synthesizeHandClap(sampleRate: number, rand: () => number = Math.random): Float32Array {
  const n = Math.floor(sampleRate * 0.16);
  const out = new Float32Array(n);
  const offset2 = Math.floor(sampleRate * (0.008 + rand() * 0.016));
  const crack = biquadBandpass(sampleRate, 2150 + rand() * 700, 3.4);
  const body = biquadBandpass(sampleRate, 980 + rand() * 280, 1.55);
  const air = biquadBandpass(sampleRate, 4300 + rand() * 900, 0.95);
  const palm = biquadBandpass(sampleRate, 480 + rand() * 90, 1.7);
  const tauCrack = 0.013 + rand() * 0.006;
  const tauBody = 0.032 + rand() * 0.01;

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env1 = Math.exp(-t / tauCrack);
    const t2 = t - offset2 / sampleRate;
    const env2 = t2 >= 0 ? Math.exp(-t2 / (tauCrack + 0.003)) : 0;
    const envBody = Math.exp(-t / tauBody);
    const noise = rand() * 2 - 1;
    const impulse = i === 0 ? 0.95 : i === 1 ? 0.35 : 0;
    const burst = noise * (env1 * 0.9 + env2 * 0.75) + impulse;
    out[i] =
      crack(burst) * 0.52 +
      body(burst * 0.85) * 0.78 +
      air(burst * 0.4) * 0.22 +
      palm((impulse + noise * envBody * 0.2) * 0.55) * 0.4;
  }

  const comb = Math.max(1, Math.floor(sampleRate * (0.009 + rand() * 0.006)));
  for (let i = comb; i < n; i++) {
    out[i] += out[i - comb] * 0.16;
  }

  let peak = 0.0001;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.9 / peak;
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

const CROWD_CLAP_TIMES_SEC = [
  0, 0.17, 0.33, 0.49, 0.54, 0.71, 0.88, 0.93, 1.1, 1.27, 1.44, 1.5, 1.67, 1.84, 2.02, 2.19,
];

/** Overlapping crowd claps — irregular groups, not a metronome. */
export function synthesizeClapBed(sampleRate: number, seed = 0x9e3779b9): Float32Array {
  const durationSec = 2.4;
  const n = Math.floor(sampleRate * durationSec);
  const out = new Float32Array(n);
  const rand = mulberry32(seed);

  for (const t of CROWD_CLAP_TIMES_SEC) {
    const clap = synthesizeHandClap(sampleRate, rand);
    const start = Math.floor((t + (rand() - 0.5) * 0.018) * sampleRate);
    const gain = 0.5 + rand() * 0.42;
    for (let i = 0; i < clap.length; i++) {
      const dest = start + i;
      if (dest < 0 || dest >= n) continue;
      out[dest] += clap[i] * gain;
    }
  }

  for (let i = 0; i < n; i++) {
    out[i] = Math.tanh(out[i] * 1.05) * 0.94;
  }
  return out;
}

export function floatClapToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767)));
  }
  return out;
}
