import { isTauri, invoke } from "@tauri-apps/api/core";
export const nativeDesktop = isTauri();
type DesktopConfig = {
  backend: string;
  bridge?: string;
  version: string;
  database: string;
  build: string;
};
let configuration: DesktopConfig = {
  backend: "",
  version: "0.5.0",
  database: "IndexedDB",
  build: "BROWSER",
};
export const desktopConfig = () => configuration;
export async function initializeDesktop() {
  if (!nativeDesktop || location.hash.includes("/customer-display")) return;
  const { emitTo } = await import("@tauri-apps/api/event");
  await emitTo("splash", "taha-startup-stage", "Loading local database");
  configuration = await invoke<DesktopConfig>("desktop_init");
  await emitTo("splash", "taha-startup-stage", "Checking shop backend");
  if (configuration.backend) {
    const healthy = await nativeRequest(
      `${configuration.backend}/health`,
      { method: "GET" },
      1500,
    )
      .then((response) => response.ok)
      .catch(() => false);
    const { useSyncStore } = await import("../../stores/sync-store");
    useSyncStore.setState({ status: healthy ? "ONLINE" : "OFFLINE" });
  }
  await emitTo("splash", "taha-startup-stage", "Preparing devices");
}
export async function desktopReady() {
  if (nativeDesktop) {
    const display = location.hash.includes("/customer-display");
    if (!display) await invoke("desktop_ready");
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    window.addEventListener("keydown", (event) => {
      if (event.key !== "F11") return;
      event.preventDefault();
      const win = getCurrentWindow();
      if (display) {
        void win.setFullscreen(false).catch(() => undefined);
        return;
      }
      void win
        .isFullscreen()
        .then((active) => win.setFullscreen(!active))
        .catch(() => undefined);
    });
  }
}
export async function nativeRequest(
  url: string,
  options: RequestInit,
  timeout: number,
) {
  const headers = new Headers(options.headers);
  let body = "";
  if (options.body instanceof FormData) {
    const req = new Request(url, {
      method: options.method || "POST",
      body: options.body,
    });
    headers.set("Content-Type", req.headers.get("Content-Type")!);
    body = encode(new Uint8Array(await req.arrayBuffer()));
  } else if (typeof options.body === "string")
    body = encode(new TextEncoder().encode(options.body));
  const r = await invoke<{ status: number; body: string; contentType: string }>(
    "desktop_http",
    {
      request: {
        url,
        method: options.method || "GET",
        headers: Object.fromEntries(headers.entries()),
        body,
        timeout,
      },
    },
  );
  return new Response(
    r.status === 204
      ? null
      : Uint8Array.from(atob(r.body), (c) => c.charCodeAt(0)),
    { status: r.status, headers: { "Content-Type": r.contentType } },
  );
}
function encode(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
