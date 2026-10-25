/**
 * Pediatric Chime Acoustic Modal Synthesizer
 * Generates resonant, harmonic Koshi and tubular bell strikes with physics-based
 * inharmonic modes, velocity-sensitive amplitude, and spatial stereo panning.
 */

import { ChimeScalePreset } from './windChimeTypes';

let sharedAudioCtx: AudioContext | null = null;

export function getChimeAudioContext(): AudioContext | null {
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

export interface ChimeNoteDef {
  name: string;
  freq: number;
}

export const CHIME_SCALE_DEFINITIONS: Record<ChimeScalePreset, ChimeNoteDef[]> = {
  // Koshi Aria (Air): A C E A B C (Uplifting, airy, gentle)
  koshi_aria: [
    { name: 'A4', freq: 440.0 },
    { name: 'C5', freq: 523.25 },
    { name: 'E5', freq: 659.25 },
    { name: 'A5', freq: 880.0 },
    { name: 'B5', freq: 987.77 },
    { name: 'C6', freq: 1046.5 },
  ],
  // Koshi Terra (Earth): G C E F G C (Grounding, deep, centered)
  koshi_terra: [
    { name: 'G4', freq: 392.0 },
    { name: 'C5', freq: 523.25 },
    { name: 'E5', freq: 659.25 },
    { name: 'F5', freq: 698.46 },
    { name: 'G5', freq: 783.99 },
    { name: 'C6', freq: 1046.5 },
  ],
  // Pentatonic Major: C D E G A C (Bright, playful, child-friendly)
  pentatonic_major: [
    { name: 'C5', freq: 523.25 },
    { name: 'D5', freq: 587.33 },
    { name: 'E5', freq: 659.25 },
    { name: 'G5', freq: 783.99 },
    { name: 'A5', freq: 880.0 },
    { name: 'C6', freq: 1046.5 },
  ],
  // Zen Solfeggio: 396, 417, 528, 639, 741, 852 Hz (Calming meditative frequencies)
  zen_solfeggio: [
    { name: '396 Hz', freq: 396.0 },
    { name: '417 Hz', freq: 417.0 },
    { name: '528 Hz', freq: 528.0 },
    { name: '639 Hz', freq: 639.0 },
    { name: '741 Hz', freq: 741.0 },
    { name: '852 Hz', freq: 852.0 },
  ],
};

export interface PlayChimeStrikeOptions {
  tubeIndex: number; // 0..5
  scalePreset: ChimeScalePreset;
  velocityPxPerSec?: number; // 50 .. 800+
  pan?: number; // -1.0 (full left) to +1.0 (full right)
  decaySec?: number; // duration of reverberation
  enableStereo?: boolean;
}

/**
 * Triggers a physical-modeling synthesis of a metal tubular chime.
 * Includes Euler-Bernoulli cylindrical overtone ratios for authentic bell resonance.
 */
export function playSynthesizedChimeStrike(options: PlayChimeStrikeOptions): { noteName: string; freq: number } | null {
  const ctx = getChimeAudioContext();
  if (!ctx) return null;

  const {
    tubeIndex,
    scalePreset,
    velocityPxPerSec = 250,
    pan = 0,
    decaySec = 3.2,
    enableStereo = true,
  } = options;

  const scale = CHIME_SCALE_DEFINITIONS[scalePreset] || CHIME_SCALE_DEFINITIONS.koshi_aria;
  const note = scale[Math.max(0, Math.min(tubeIndex, scale.length - 1))];
  const fundamental = note.freq;

  // Velocity-sensitive volume calculation: soft touch = gentle whisper, strong swipe = full resonance
  const clampedVel = Math.max(80, Math.min(750, velocityPxPerSec));
  const normalizedIntensity = (clampedVel - 80) / (750 - 80); // 0.0 to 1.0
  const masterGainLevel = 0.12 + normalizedIntensity * 0.35; // gentle, never harsh

  const now = ctx.currentTime;

  // Master Gain for this chime note
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(masterGainLevel, now);

  // Stereo Panning
  let destinationNode: AudioNode = masterGain;
  if (enableStereo && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), now);
    masterGain.connect(panner);
    panner.connect(ctx.destination);
  } else {
    masterGain.connect(ctx.destination);
  }

  // Cylindrical tubular chime modal ratios (inharmonic modes)
  // Mode 1 (Fundamental): 1.0x
  // Mode 2 (First overtone): ~2.756x
  // Mode 3 (Second overtone): ~5.404x
  // Mode 4 (Shimmer overtone): ~8.93x
  const modes = [
    { ratio: 1.0, weight: 1.0, decayFactor: 1.0 },
    { ratio: 2.756, weight: 0.38, decayFactor: 0.55 },
    { ratio: 5.404, weight: 0.18, decayFactor: 0.32 },
    { ratio: 8.933, weight: 0.07, decayFactor: 0.18 },
  ];

  modes.forEach((mode) => {
    const osc = ctx.createOscillator();
    const modeGain = ctx.createGain();

    osc.type = mode.ratio === 1.0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(fundamental * mode.ratio, now);

    const modeDuration = Math.max(0.6, decaySec * mode.decayFactor);
    modeGain.gain.setValueAtTime(mode.weight, now);
    // Exponential dampening decay
    modeGain.gain.exponentialRampToValueAtTime(0.0001, now + modeDuration);

    osc.connect(modeGain);
    modeGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + modeDuration);
  });

  // Metallic Transient "Clink" (Strike Impact Mallet)
  try {
    const impactDuration = 0.035;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.floor(sampleRate * impactDuration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(2400, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08 * (0.5 + normalizedIntensity * 0.5), now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + impactDuration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noiseSource.start(now);
  } catch (_) {
    // Ignore noise transient if buffer fails
  }

  // Light haptic feedback if supported
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const hapticDuration = Math.round(15 + normalizedIntensity * 30);
      navigator.vibrate(hapticDuration);
    } catch (_) {}
  }

  return { noteName: note.name, freq: note.freq };
}
