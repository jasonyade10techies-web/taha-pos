import { invoke } from "@tauri-apps/api/core";
import { desktopScope } from "./database";
const references = new Map<string, Promise<string>>();
export function preserveDesktopImage(data: string, kind: string) {
  const key = kind + data;
  let promise = references.get(key);
  if (!promise) {
    const id = crypto.randomUUID();
    promise = invoke("desktop_image", {
      scope: desktopScope(),
      id,
      data: data.split(",")[1],
      kind,
      cloudPath: null,
    }).then(() => `taha-pending-media:${id}`);
    references.set(key, promise);
    promise.catch(() => references.delete(key));
  }
  return promise;
}
export async function desktopImage(id: string) {
  return invoke<{ path?: string; body?: string; mime?: string }>(
    "desktop_image",
    {
      scope: desktopScope(),
      id,
      data: null,
      kind: null,
      cloudPath: null,
    },
  );
}
export async function preservedImagePath(data: string, kind: string) {
  const reference = references.get(kind + data);
  if (!reference) return;
  return (
    await desktopImage((await reference).slice("taha-pending-media:".length))
  ).path;
}
export const acknowledgeImage = (id: string, path: string) =>
  invoke("desktop_image", {
    scope: desktopScope(),
    id,
    data: null,
    kind: null,
    cloudPath: path,
  });
