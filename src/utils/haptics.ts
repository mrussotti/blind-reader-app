import * as Haptics from "expo-haptics";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Double pulse for success. */
export async function playSuccessHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(100);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/** Triple pulse for error. */
export async function playErrorHaptic() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}

/** Light tap for button press. */
export async function playButtonHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}
