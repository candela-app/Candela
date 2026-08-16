import * as Speech from 'expo-speech';

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

export function stopSpeaking() {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
