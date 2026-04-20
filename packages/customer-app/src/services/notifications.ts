import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "./api";

// Configure how notifications are presented when app is in foreground.
// Expo SDK 51+ replaced shouldShowAlert with shouldShowBanner + shouldShowList.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

/**
 * Register for push notifications and send token to backend.
 */
export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    // Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Get Expo push token — requires EAS projectId in production
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await api.post("/api/notifications/register", {
      token,
      platform: Platform.OS as "ios" | "android",
    });

    return token;
  } catch (err) {
    console.log("Push notification registration skipped:", err);
    return null;
  }
}

/**
 * Unregister push token on logout.
 */
export async function unregisterPushToken() {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.post("/api/notifications/unregister", { token: tokenData.data });
  } catch {
    // Best effort
  }
}

/**
 * Hook to register for push notifications and listen for them.
 */
export function usePushNotifications(
  onNotification?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
  const notificationListener = useRef<{ remove(): void } | null>(null);
  const responseListener = useRef<{ remove(): void } | null>(null);

  useEffect(() => {
    registerForPushNotifications().catch(() => {});

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: Notifications.Notification) => {
        onNotification?.(notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        onNotificationResponse?.(response);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
