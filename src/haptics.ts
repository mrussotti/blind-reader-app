import * as Haptics from "expo-haptics";

export function hapticCapture(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function hapticTick(): void {
  Haptics.selectionAsync().catch(() => {});
}
