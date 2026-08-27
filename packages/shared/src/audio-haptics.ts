// Web Audio API Synthesizer and Web Vibration Haptics Utility

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Short whoosh / air-sweep for correct responses (SVI-style).
 * Filtered noise with a fast gain drop (~180ms) + light haptic.
 */
export function playWhooshSoundAndHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(40);
    } catch (_) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const duration = 0.18;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount;
      const envelope = Math.pow(1 - t, 1.6);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + duration);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration);
  } catch (_) {}
}

/**
 * Shorter, quieter SVI whoosh for motion (finger-drag / letter turning).
 * No haptic — meant to fire repeatedly along a path without buzzing.
 */
export function playSviMoveWhoosh(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const duration = 0.1;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount;
      const envelope = Math.pow(1 - t, 1.35);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + duration);
    filter.Q.setValueAtTime(0.65, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration);
  } catch (_) {}
}

/**
 * Correct-target feedback — same SVI whoosh used across all games.
 */
export function playCorrectSoundAndHaptic(): void {
  playWhooshSoundAndHaptic();
}

/**
 * Play a descending buzz/bonk sound (320 Hz -> 180 Hz)
 * and trigger a double haptic pulse for incorrect bubble selections.
 */
export function playWrongSoundAndHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([80, 100, 80]);
    } catch (_) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) {}
}

export const playWrongBubbleSoundAndHaptic = playWrongSoundAndHaptic;
export const playSuccessTone = playCorrectSoundAndHaptic;
export const playErrorTone = playWrongSoundAndHaptic;

/**
 * Soft flip / open tap for Location Memory cells (peek or reveal a closed box).
 * Short filtered click + light haptic — distinct from the correct/wrong whoosh.
 */
export function playOpenTapSoundAndHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(25);
    } catch (_) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const duration = 0.09;
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, t0);
    osc.frequency.exponentialRampToValueAtTime(280, t0 + duration);
    gain.gain.setValueAtTime(0.22, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);

    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * 0.35;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, t0);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.05);
  } catch (_) {}
}

/**
 * Play a low dull thud sound (150 Hz -> 65 Hz)
 * and trigger a short triple pulse for miss presses (clicking empty wheel/game background).
 */
export function playMissPressSoundAndHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([60, 40, 60]);
    } catch (_) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (_) {}
}

/**
 * Play victory ascending arpeggio and success haptic pattern
 * (300ms vibration followed by a 100ms pulse).
 */
export function playSuccessSoundAndHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([300, 100, 100]);
    } catch (_) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.25);
    });
  } catch (_) {}
}

/**
 * Play a gentle bee buzzing sound pulse (160 Hz sawtooth with soft lowpass filtering)
 */
export function playBeeBuzzSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const masterGain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);

    // LFO to create buzzing frequency modulation
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(25, ctx.currentTime);
    lfoGain.gain.setValueAtTime(15, ctx.currentTime);
    lfo.connect(osc.frequency);

    // Soft lowpass filter to make it pleasant, not harsh
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);

    masterGain.gain.setValueAtTime(0.08, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    lfo.start(ctx.currentTime);
    osc.start(ctx.currentTime);
    lfo.stop(ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
}

/**
 * Play a soft gentle warning wobble hum (110 Hz pitch dip) when straying off path.
 */
export function playSoftOffPathSound(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(40);
    } catch (_) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (_) {}
}

