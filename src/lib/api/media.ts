import { cachedCounterRead } from "./read-cache";
import { nativeDesktop } from "../desktop/runtime";
import { useSyncStore } from "../../stores/sync-store";
import {
  preserveDesktopImage,
  desktopImage,
  preservedImagePath,
} from "../desktop/images";
import { apiRequest } from "./client";
import { useSessionStore } from "../../stores/session-store";
import { imageDataBlob } from "../media";
import { bundledMobile } from "../mobile/runtime";
import { uploadBrowserMedia } from "./direct-upload";
export const storePath = () =>
  `/stores/${encodeURIComponent(useSessionStore.getState().context?.store?.id ?? "")}`;
export async function apiMediaUrls(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  return unique.length && navigator.onLine
    ? await cachedCounterRead(`media-links:${unique.join("|")}`, () =>
        apiRequest<Record<string, string>>(`${storePath()}/media/urls`, {
          method: "POST",
          body: JSON.stringify({ paths: unique }),
        }),
      )
    : {};
}
const pendingUploads = new Map<string, Promise<string>>();
window.addEventListener("taha-session-clear", () => pendingUploads.clear());
export async function apiStoreMedia(
  data: string,
  kind: string,
  existing = "",
  entityId?: string,
  cameraJobId?: string,
  uploadSlot = "",
  staged = false,
  uploadId?: string,
) {
  if (!data) return "";
  if (nativeDesktop && !uploadId && data.startsWith("data:image/")) {
    const path = await preservedImagePath(data, kind);
    if (path) return path;
  }
  if (nativeDesktop && data.startsWith("taha-pending-media:")) {
    const pending = await desktopImage(
      data.slice("taha-pending-media:".length),
    );
    if (pending.path) return pending.path;
    throw new Error(
      "This photo is saved locally and is waiting to upload. Retry after synchronization.",
    );
  }
  if (
    nativeDesktop &&
    data.startsWith("data:image/") &&
    useSyncStore.getState().status === "OFFLINE"
  ) {
    await preserveDesktopImage(data, kind);
    window.dispatchEvent(new Event("taha-sync-retry"));
    throw new Error(
      "Your photo is preserved locally. Reconnect before saving this record.",
    );
  }
  if (!data.startsWith("data:image/"))
    return existing || data.replace(/^taha-media:/, "");
  const cacheKey = entityId
    ? `${storePath()}:${kind}:${entityId}:${uploadSlot}:${data}`
    : "";
  if (cacheKey && pendingUploads.has(cacheKey))
    return pendingUploads.get(cacheKey)!;
  const upload = async () => {
    const blob = imageDataBlob(data);
    if (!nativeDesktop && !bundledMobile && !cameraJobId) {
      const path = await uploadBrowserMedia(storePath(), blob, {kind, entityId, staged, uploadId}, apiRequest);
      if (path !== null) return path;
    }
    const form = new FormData();
    form.set("file", new File([blob], "capture.jpg", { type: blob.type }));
    form.set("kind", kind);
    if (staged) form.set("staged", "true");
    if (uploadId) form.set("uploadId", uploadId);
    if (entityId) form.set("entityId", entityId);
    if (cameraJobId) form.set("cameraJobId", cameraJobId);
    return (
      await apiRequest<{ path: string }>(`${storePath()}/media`, {
        method: "POST",
        body: form,
      })
    ).path;
  };
  const promise = upload().catch((cause) => {
    if (cacheKey) pendingUploads.delete(cacheKey);
    throw cause;
  });
  if (cacheKey) {
    if (pendingUploads.size >= 32)
      pendingUploads.delete(pendingUploads.keys().next().value!);
    pendingUploads.set(cacheKey, promise);
  }
  return promise;
}

