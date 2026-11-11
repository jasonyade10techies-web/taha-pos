import { apiEnabled, getApiBaseUrl, getDeviceBridgeBaseUrl } from "../config";
import { apiRequest, ApiError, getAccessToken, getApiCounterToken } from "../api/client";
import { shopFetch } from "../mobile/transport";
import { useSessionStore } from "../../stores/session-store";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import type { SessionContext } from "../../types/auth";
let accessToken: string | null = null;
let refreshing: Promise<SessionContext | null> | null = null;
let generation = 0;
export const sharedBridgeSession = () => apiEnabled && getApiBaseUrl() === getDeviceBridgeBaseUrl();
export const bridgeToken = () => sharedBridgeSession() ? getAccessToken() : accessToken;
export const bridgeCounterToken = () => sharedBridgeSession() ? getApiCounterToken() : null;
const changed = () => window.dispatchEvent(new Event("taha-bridge-auth"));
// A non-sensitive hint avoids probing an unauthenticated shop on every demo-page reload.
const sessionHint=()=>`taha-bridge-session:${getDeviceBridgeBaseUrl()}`;
async function direct<T>(path:string,options:RequestInit = {},retry = true):Promise<T> {
  const base = getDeviceBridgeBaseUrl();
  if (!base) throw new ApiError("Connect this counter to your shop before pairing a phone.", 0);
  const requestGeneration = generation, headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try { response = await shopFetch(base + path,{...options,headers,credentials:"include"},options.body instanceof FormData?30000:10000); }
  catch { throw new ApiError("Could not reach the shop server. Check the connection and try again.", 0); }
  if (generation !== requestGeneration) throw new ApiError("Your shop session changed. Try again.",401);
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await restoreBridgeSession()) return direct(path,options,false);
    throw new ApiError("Sign in to connect this counter to your shop.",401);
  }
  const text = response.status === 204 ? "" : await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new ApiError(typeof data?.message === "string" ? data.message : "The shop could not complete this request. Try again.",response.status);
  return data as T;
}
export const bridgeRequest = <T>(path:string,options:RequestInit = {}) => sharedBridgeSession() ? apiRequest<T>(path,options) : direct<T>(path,options);
export async function restoreBridgeSession() {
  if (sharedBridgeSession()) {
    const context = useSessionStore.getState().context;
    useDeviceBridgeStore.setState({context,auth:context ? "signed-in" : "signed-out"});
    return context;
  }
  if (refreshing) return refreshing;
  if(localStorage.getItem(sessionHint())!=="1"){
    useDeviceBridgeStore.setState({auth:"signed-out",context:null});return null;
  }
  refreshing = direct<{accessToken:string;context:SessionContext}>("/auth/refresh",{method:"POST"},false).then(result => {
    accessToken = result.accessToken;
    useDeviceBridgeStore.setState({context:result.context,auth:"signed-in",error:""}); changed();
    return result.context;
  }).catch(cause => {
    if(cause instanceof ApiError&&cause.status===401)localStorage.removeItem(sessionHint());
    accessToken = null;
    useDeviceBridgeStore.setState({context:null,auth:"signed-out",connected:false,error:cause instanceof ApiError && cause.status===401 ? "" : "Could not reach the shop server."});
    changed(); return null;
  }).finally(() => { refreshing = null; });
  return refreshing;
}
export async function signInBridge(email:string,password:string) {
  const result = await direct<{accessToken:string;context:SessionContext}>("/auth/login",{method:"POST",body:JSON.stringify({email,password,deviceName:"Main Counter device bridge"})},false);
  accessToken = result.accessToken;
  localStorage.setItem(sessionHint(),"1");
  useDeviceBridgeStore.setState({context:result.context,auth:"signed-in",error:""}); changed();
  return result.context;
}
export async function signOutBridge() {
  try { if (!sharedBridgeSession() && accessToken) await direct("/auth/logout",{method:"POST"},false); }
  finally { localStorage.removeItem(sessionHint());generation++; accessToken = null;useDeviceBridgeStore.setState({context:null,auth:"signed-out",connected:false,socket:false,devices:[],ownPair:null,terminalRegistered:false}); changed(); }
}
window.addEventListener("taha-session-clear",() => { if(!sharedBridgeSession())void signOutBridge(); });
window.addEventListener("taha-shop-changed",() => {generation++;accessToken=null;useDeviceBridgeStore.setState({context:null,auth:"signed-out",connected:false,socket:false,devices:[],ownPair:null,terminalRegistered:false});changed();});
