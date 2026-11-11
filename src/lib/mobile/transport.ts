import { bundledMobile } from "./runtime";
import {nativeDesktop,nativeRequest} from '../desktop/runtime';
let sequence = 0;
const pending = new Map<
  string,
  {
    resolve: (r: Response) => void;
    reject: (e: Error) => void;
    cleanup: () => void;
  }
>();
const bytesToBase64 = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};
/** Native HTTP retains HttpOnly refresh cookies outside JS; no credentials in diagnostics/storage. */
export async function shopFetch(
  url: string,
  options: RequestInit = {},
  timeout = 8000,
): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(
    () => abort.abort(new DOMException("Connection timed out", "TimeoutError")),
    timeout,
  );
  const onAbort = () => abort.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    if(nativeDesktop)return await nativeRequest(url,options,timeout);
    if (!bundledMobile || !window.TahaNative)
      return await fetch(url, { ...options, signal: abort.signal });
    let body = "";
    const headers = new Headers(options.headers);
    if (options.body instanceof FormData) {
      const request = new Request(url, {
        method: options.method || "POST",
        body: options.body,
      });
      headers.set("Content-Type", request.headers.get("Content-Type")!);
      body = bytesToBase64(new Uint8Array(await request.arrayBuffer()));
    } else if (typeof options.body === "string")
      body = bytesToBase64(new TextEncoder().encode(options.body));
    else if (options.body) throw new Error("Unsupported mobile request body");
    if (abort.signal.aborted) throw abort.signal.reason;
    window.__tahaNativeResponse ??= (r) => {
      const job = pending.get(r.id);
      if (!job) return;
      pending.delete(r.id);
      job.cleanup();
      if (r.error) job.reject(new Error(r.error));
      else {
        const bytes = Uint8Array.from(atob(r.body || ""), (c) =>
          c.charCodeAt(0),
        );
        job.resolve(
          new Response(r.status === 204 ? null : bytes, {
            status: r.status || 500,
            headers: { "Content-Type": r.contentType || "application/json" },
          }),
        );
      }
    };
    return await new Promise<Response>((resolve, reject) => {
      const id = String(++sequence);
      const cancelled = () => {
        pending.delete(id);
        reject(abort.signal.reason);
      };
      pending.set(id, {
        resolve,
        reject,
        cleanup: () => abort.signal.removeEventListener("abort", cancelled),
      });
      abort.signal.addEventListener("abort", cancelled, { once: true });
      window.TahaNative!.request(
        JSON.stringify({
          id,
          url,
          method: options.method || "GET",
          headers: Object.fromEntries(headers.entries()),
          body,
        }),
      );
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
