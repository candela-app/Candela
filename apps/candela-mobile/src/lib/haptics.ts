import * as Haptics from 'expo-haptics';
import { playCorrectWoosh, playMissThud, playOpenTap, playWrongWoosh } from './sfx';

export async function hapticCorrect() {
  void playCorrectWoosh();
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // ignore
  }
}

export async function hapticWrong() {
  void playWrongWoosh();
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // ignore
  }
}

export async function hapticMiss() {
  void playMissThud();
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // ignore
  }
}

export async function hapticOpen() {
  void playOpenTap();
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ignore
  }
}

export async function hapticLight() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ignore
  }
}
