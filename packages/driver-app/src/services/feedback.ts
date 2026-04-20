import { Vibration, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

// Foreground notification handler is set once in services/notifications.ts
// (imported at app startup via usePushNotifications).

let permissionRequested = false;
let permissionGranted = false;

/**
 * Request notification permissions. Should be called once on app startup.
 * Subsequent calls return the cached result.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionRequested) return permissionGranted;
  permissionRequested = true;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") {
      permissionGranted = true;
    } else {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      permissionGranted = requested === "granted";
    }

    // Android: create a high-priority channel so sound/vibration actually fire
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("ride-requests", {
        name: "Richieste corsa",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        sound: "default",
        lightColor: "#4357AD",
      });
    }
  } catch {
    permissionGranted = false;
  }

  return permissionGranted;
}

/**
 * Play a vibration pattern for incoming ride requests.
 * Uses Haptics on iOS for a richer feel, Vibration on Android.
 */
export async function vibrateRideRequest() {
  try {
    if (Platform.OS === "ios") {
      // Three strong buzzes
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 400);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 800);
    } else {
      // Android: vibration pattern [wait, vibrate, wait, vibrate, ...]
      Vibration.vibrate([0, 300, 200, 300, 200, 300]);
    }
  } catch {
    // Vibration not available (e.g. simulator)
  }
}

/**
 * Play an alert sound via a local notification (works in Expo Go).
 */
export async function playRideRequestSound() {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nuova richiesta corsa",
        body: "Hai ricevuto una nuova richiesta!",
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === "android" ? { channelId: "ride-requests" } : {}),
      },
      trigger: null, // Immediate delivery
    });
  } catch {
    // Notification not available — ignore
  }
}

/**
 * Trigger both sound (via local notification) and vibration for an incoming ride request.
 */
export async function alertRideRequest() {
  await Promise.all([
    vibrateRideRequest(),
    playRideRequestSound(),
  ]);
}

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
 * Error haptic for failures.
 */
export async function hapticError() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Not available
  }
}
