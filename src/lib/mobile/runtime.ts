export const bundledMobile = import.meta.env.VITE_BUNDLED_MOBILE === "true";
export const mobileTestBuild = import.meta.env.VITE_MOBILE_TEST === "true";
export const mobileVersion = "0.5D.2";
export interface NativeShop {
  info(): string;
  configure(address: string): boolean;
  beginEnrollment?(qr:string): string;
  completeEnrollment?(id:string,challenge:string): string;
  companionSession?(): boolean;
  request(request: string): void;
  clearSession?(): void;
  scanQr?(): void;
  discoverCounters?(): void;
  stopDiscovery?(): void;
  openSettings?(): void;
  saveCapture?(capture: string): boolean;
  readCaptures?(): string;
  removeCapture?(id: string): void;
  clearPhotoOriginal?(): void;
  clearPendingPhotos?(): void;
  haptic?(): void;
  saveToGallery?(data: string): boolean;
  shareReceiptPdf?(data: string): boolean;
  openWhatsapp?(data: string): boolean;
}
declare global {
  interface Window {
    TahaNative?: NativeShop;
    __tahaNativeResponse?: (response: {
      id: string;
      status?: number;
      body?: string;
      contentType?: string;
      error?: string;
    }) => void;
    __tahaUiReady?: boolean;
    __tahaLastUiError?: string;
  }
}
export function nativeInfo(): Record<string, string> {
  try {
    return JSON.parse(window.TahaNative?.info() || "{}");
  } catch {
    return {};
  }
}
