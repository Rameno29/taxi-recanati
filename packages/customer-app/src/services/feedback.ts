import { Vibration, Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Light haptic tap for button presses and confirmations.
 */
export async function hapticTap() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Not available
  }
}

/**
 * Success haptic for ride accepted/completed.
 */
export async function hapticSuccess() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Not available
  }
}

/**
 * Warning haptic + vibration for important status changes (driver arriving, etc.).
 */
export async function hapticAlert() {
  try {
    if (Platform.OS === "ios") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Vibration.vibrate([0, 200, 100, 200]);
    }
  } catch {
    // Not available
  }
}

/**
 * Error haptic for failures or cancellations.
 */
export async function hapticError() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Not available
  }
}
