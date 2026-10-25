import { Platform } from "react-native";
import Constants from "expo-constants";
import { rpc } from "./api";
import { authStorage } from "./storage";
export async function enablePush() {
  if (Platform.OS === "web")
    throw Error(
      "Background push is available in the installed mobile app. In-app notifications remain available on web.",
    );
  if (Constants.appOwnership === "expo")
    throw Error(
      "Use a development or production build for push notifications. Expo Go does not support this feature.",
    );
  const N = await import("expo-notifications");
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("default", {
      name: "ScanIn",
      importance: N.AndroidImportance.HIGH,
    });
  const permission = await N.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw Error(
      "Notification permission was not granted. You can enable it in device settings.",
    );
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw Error("Configure your EAS project ID first.");
  const { data } = await N.getExpoPushTokenAsync({ projectId });
  await rpc("scanin_push_token", { value: data });
  await authStorage.setItem("scanin-push-token", data);
}
export async function disconnectPush() {
  const token = await authStorage.getItem("scanin-push-token");
  if (token) await rpc("scanin_remove_push_token", { value: token });
  await authStorage.removeItem("scanin-push-token");
}
