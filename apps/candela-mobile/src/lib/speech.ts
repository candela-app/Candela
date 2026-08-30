import * as Speech from 'expo-speech';
import { clapForLine } from '@candela/shared/rn';

export function speak(text: string, options?: { rate?: number; pitch?: number; language?: string }) {
  try {
    Speech.stop();
    Speech.speak(text, {
      language: options?.language ?? 'en-IN',
      rate: options?.rate ?? 0.85,
      pitch: options?.pitch ?? 1,
    });
  } catch {
    // Speech is optional on some emulators.
  }
}

export function speakClapFor(patientName?: string | null, onDone?: () => void) {
  try {
    Speech.stop();
    Speech.speak(clapForLine(patientName), {
      language: 'en-US',
      rate: 0.92,
      pitch: 1.05,
      onDone,
      onError: onDone,
    });
  } catch {
    onDone?.();
  }
}

export function stopSpeaking() {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
