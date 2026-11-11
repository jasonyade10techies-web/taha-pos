import { apiRequest } from "./api/client";
import { storePath } from "./api/media";
export async function enableCameraNotifications() {
  if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Notifications require HTTPS and a supported browser. Use the camera request QR as a fallback.");
  const { publicKey } = await apiRequest<{ publicKey: string }>(`${storePath()}/push/key`);
  if (!publicKey) throw new Error("Push notifications are not configured on the shop server. Use the request QR instead.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed. Camera requests remain available on this screen.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = publicKey.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(key.padEnd(Math.ceil(key.length / 4) * 4, "="));
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(binary, c => c.charCodeAt(0)) });
  await apiRequest(`${storePath()}/push/subscriptions`, { method: "POST", body: JSON.stringify(subscription.toJSON()) });
}
