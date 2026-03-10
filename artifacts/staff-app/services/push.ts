import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAccessToken } from "./api";

const PUSH_TOKEN_KEY = "push_expo_token";
const PUSH_REGISTERED_KEY = "push_registered";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const Notifications = await import("expo-notifications");

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    await registerTokenWithBackend(token);

    return token;
  } catch {
    return null;
  }
}

async function registerTokenWithBackend(pushToken: string) {
  try {
    const authToken = await getAccessToken();
    if (!authToken) return;

    const res = await fetch(`${BASE_URL}/api/push/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token: pushToken,
        platform: Platform.OS,
        appVersion: "1.0.0",
      }),
    });

    if (res.ok) {
      await AsyncStorage.setItem(PUSH_REGISTERED_KEY, "true");
    }
  } catch {}
}

export async function unregisterPushToken() {
  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!pushToken) return;

    const authToken = await getAccessToken();
    if (authToken) {
      await fetch(`${BASE_URL}/api/push/unregister`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: pushToken }),
      });
    }

    await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_REGISTERED_KEY]);
  } catch {}
}

export async function getPushRegistrationStatus(): Promise<{
  hasToken: boolean;
  isRegistered: boolean;
  token: string | null;
}> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  const registered = await AsyncStorage.getItem(PUSH_REGISTERED_KEY);
  return {
    hasToken: !!token,
    isRegistered: registered === "true",
    token,
  };
}

export function setupNotificationHandler() {
  if (Platform.OS === "web") return;

  import("expo-notifications").then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  });
}
