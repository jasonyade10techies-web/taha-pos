import { imageDataBlob } from "../media";
import { getApiBaseUrl } from "../config";
export type PendingCapture = {
  captureId: string;
  requestId: string;
  data: string;
  createdAt: number;
  shop: string;
};
const captures = new Map<string, PendingCapture>();
let restoredFor: string|undefined;
export function retainCapture(requestId: string, data: string) {
  const capture: PendingCapture = {
    captureId: crypto.randomUUID(),
    requestId,
    data,
    createdAt: Date.now(),
    shop: getApiBaseUrl(),
  };
  const blob = imageDataBlob(data);
  if (blob.size > 8 * 1024 * 1024)
    throw new Error("The photo is too large. Take another photo.");
  if (
    window.TahaNative?.saveCapture &&
    !window.TahaNative.saveCapture(JSON.stringify(capture))
  )
    throw new Error(
      "The phone could not retain this photo for retry. Free some storage and try again.",
    );
  captures.set(capture.captureId, capture);
  window.dispatchEvent(new Event("taha-pending-photos"));
  window.TahaNative?.clearPhotoOriginal?.();
  return capture;
}
export function pendingCaptures(requestId?: string) {
  try {
    if(restoredFor!==getApiBaseUrl()){
    const saved: PendingCapture[] = JSON.parse(
      window.TahaNative?.readCaptures?.() || "[]",
    );
    for (const capture of saved)
      if (
        capture.shop === getApiBaseUrl()
      )
        captures.set(capture.captureId, capture);
    restoredFor=getApiBaseUrl();}
  } catch {
    /* A corrupt temporary capture never prevents the queue rendering. */
  }
  return [...captures.values()].filter(
    (c) => (!requestId||c.requestId === requestId) && c.shop === getApiBaseUrl(),
  );
}
export const pendingCapture = (requestId: string) =>
  pendingCaptures(requestId)[0];
export function discardCapture(requestId: string, captureId?: string) {
  for (const capture of pendingCaptures(requestId))
    if (!captureId || capture.captureId === captureId) {
      window.TahaNative?.removeCapture?.(capture.captureId);
      captures.delete(capture.captureId);
      window.dispatchEvent(new Event("taha-pending-photos"));
    }
}
window.addEventListener("taha-session-clear", () => {captures.clear();restoredFor=undefined;});

window.addEventListener("taha-private-photos-clear", () => {captures.clear();restoredFor=undefined;});

window.addEventListener("taha-shop-changed",()=>{captures.clear();restoredFor=undefined;});
