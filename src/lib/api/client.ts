import { getApiBaseUrl, apiConfigured } from "../config";
import {nativeDesktop} from '../desktop/runtime';
import {invoke} from '@tauri-apps/api/core';
import { bundledMobile } from "../mobile/runtime";
import { shopFetch } from "../mobile/transport";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import type { SessionContext } from "../../types/auth";
let token: string | null = null;
let counterToken: string | null = null;
let refreshPromise: Promise<SessionContext | null> | null = null;
let sessionGeneration=0;
export const getApiSessionRevision=()=>sessionGeneration;
export const getAccessToken = () => token;
export const getApiCounterToken = () => counterToken;
export function acceptCompanionSession(result:{accessToken:string;context:SessionContext}){++sessionGeneration;token=result.accessToken;counterToken=null;tokenChanged();window.dispatchEvent(new Event('taha-session-refresh'));return result.context;}
const tokenChanged = () => window.dispatchEvent(new Event("taha-api-token"));
// Browser tabs share an HttpOnly refresh cookie, but not this module's promise.
// Serialize cookie-changing requests across documents. Native bridges retain
// their existing transport/session policy; no token or password enters storage.
const browserSession=!bundledMobile&&!nativeDesktop;
let leavingDocument=false;
window.addEventListener('pagehide',()=>{leavingDocument=true;});
window.addEventListener('beforeunload',()=>{leavingDocument=true;});
window.addEventListener('pageshow',()=>{leavingDocument=false;});
async function cookieOperation<T>(action:()=>Promise<T>):Promise<T>{
  if(!browserSession||!navigator.locks)return await action();
  const key=`taha-auth:${getApiBaseUrl()}`;
  return await navigator.locks.request(key,async()=>{
    // A document can disappear while a keepalive response is still setting its
    // cookie. A nonsecret, bounded marker survives that document. A successor
    // waits out the original 15s transport deadline before rotating again.
    // This grants no replay grace and cannot authenticate a request.
    let marker:string|null=null;
    try{
      const previous=localStorage.getItem(key);
      if(previous){const value=JSON.parse(previous) as {until?:number};const until=value.until;
        if(typeof until==='number'&&Number.isFinite(until)&&until<=Date.now()+17000)
          while(Date.now()<until&&localStorage.getItem(key)===previous)await new Promise(resolve=>setTimeout(resolve,50));
      }
      marker=JSON.stringify({id:crypto.randomUUID(),until:Date.now()+17000});localStorage.setItem(key,marker);
    }catch{/* Storage-disabled browsers retain document-level lock protection. */}
    try{return await action();}finally{try{if(!leavingDocument&&marker&&localStorage.getItem(key)===marker)localStorage.removeItem(key);}catch{/* No session secret is stored here. */}}
  });
}
window.addEventListener("taha-shop-changed",()=>{sessionGeneration++;token=null;counterToken=null;tokenChanged();});
export const setApiCounterToken = (value: string | null) => { counterToken = value; tokenChanged(); };
export class ApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
async function responseBody<T>(response: Response): Promise<T> {
  const body = response.status === 204 ? "" : await response.text();
  let data;
  try { data = body ? JSON.parse(body) : null; }
  catch { data = body; } // NestJS scalar UUID responses use text/plain.
  if (!response.ok) throw new ApiError(typeof data?.message === "string" ? data.message : "The request could not be completed. Please try again.", response.status, data?.code);
  return data as T;
}
export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const generation=sessionGeneration;
  if (!apiConfigured) throw new ApiError("Configure a secure shop API URL before signing in.", 0);
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (counterToken) headers.set("X-Counter-Session", counterToken);
  let response: Response;
  try { response = await shopFetch(`${getApiBaseUrl()}${path}`, { ...options, headers, credentials: "include" },options.body instanceof FormData?30000:15000); }
  catch { if(bundledMobile)useShopConnectionStore.getState().markFailure();throw new ApiError("Cannot reach the shop server. Check your connection and try again.", 0); }
  if(generation!==sessionGeneration)throw new ApiError("The shop address changed. Retry in the selected shop.",0);
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    const context = await refreshApiSession();
    if (context) return apiRequest(path, options, false);
    window.dispatchEvent(new Event("taha-api-expired"));
  }
  return responseBody<T>(response);
}
export async function refreshApiSession() {
  if (refreshPromise) return refreshPromise;
  const generation=sessionGeneration;
  refreshPromise = cookieOperation(async()=>{
    if(generation!==sessionGeneration)return null;
    const data=await apiRequest<{ accessToken: string; context: SessionContext }>("/auth/refresh", { method: "POST",keepalive:browserSession }, false);
    if(generation!==sessionGeneration)return null;token = data.accessToken; tokenChanged(); return data.context;
  }).catch(cause => {
    if(generation!==sessionGeneration)return null;
    if (cause instanceof ApiError && cause.status === 401) { token = null; counterToken = null; tokenChanged(); return null; }
    throw cause;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}
export const apiAuth = {
  async login(email: string, password: string) {
    const generation=++sessionGeneration;
    const result = await cookieOperation(()=>{if(generation!==sessionGeneration)throw new ApiError("Sign-in changed. Please retry.",0);return apiRequest<{ accessToken: string; context: SessionContext }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);});
    if(generation!==sessionGeneration)throw new ApiError("The shop address changed. Sign in to the selected shop again.",0);
    token = result.accessToken; counterToken = null; tokenChanged(); window.dispatchEvent(new Event("taha-session-refresh")); return result.context;
  },
  async logout() {const generation=sessionGeneration; try { await cookieOperation(()=>generation===sessionGeneration?apiRequest("/auth/logout", { method: "POST" }, false):Promise.resolve(null)); } finally { if(generation===sessionGeneration){++sessionGeneration;token = null; counterToken = null;if(nativeDesktop)await invoke('desktop_clear_session');if(bundledMobile)window.TahaNative?.clearSession?.();tokenChanged();} } },
  context: () => apiRequest<SessionContext>("/auth/session"),
  changePassword: (currentPassword: string, newPassword: string) => apiRequest("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
};
