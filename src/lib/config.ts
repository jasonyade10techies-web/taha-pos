import {bundledMobile} from "./mobile/runtime";
import {nativeDesktop,desktopConfig} from './desktop/runtime';
import {useShopConnectionStore} from "../stores/shop-connection-store";
// Missing configuration fails closed. Development selects local explicitly.
export const dataProvider =
  nativeDesktop && import.meta.env.PROD ? "api" : import.meta.env.VITE_DATA_PROVIDER === "local" ? "local" : import.meta.env.VITE_DATA_PROVIDER === "supabase" ? "supabase" : "api";
export const localDemoEnabled = dataProvider === "local";
export const mockAuthEnabled =
  localDemoEnabled && import.meta.env.VITE_USE_MOCK_AUTH === "true";
export const demoPinEnabled = localDemoEnabled && !import.meta.env.PROD;
export const googleEnabled =
  import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED === "true";
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
export const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();
function validPublicKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
        .role === "anon"
    );
  } catch {
    return false;
  }
}
function validUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname))
    );
  } catch {
    return false;
  }
}
export const supabaseConfigured = Boolean(
  validUrl(supabaseUrl) &&
  supabasePublicKey &&
  validPublicKey(supabasePublicKey),
);
export const configurationMessage =
  "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the app. Only public client keys are accepted.";

export const apiEnabled = dataProvider === "api";
const requestedApiUrl = import.meta.env.VITE_API_URL?.trim() || "/api/v1";
export const apiBaseUrl = requestedApiUrl.replace(/\/$/, "");
export const apiConfigured = nativeDesktop ? !!desktopConfig().backend : apiBaseUrl === "/api/v1" || validUrl(apiBaseUrl);
export const getApiBaseUrl=()=>nativeDesktop ? desktopConfig().backend : bundledMobile ? `${useShopConnectionStore.getState().baseUrl}/api/v1` : apiBaseUrl;
export const backendConfigured = apiEnabled ? apiConfigured : supabaseConfigured;

// Device communication is independent of the business repository provider.
const bridgeAddress = import.meta.env.VITE_DEVICE_BRIDGE_URL?.trim() || import.meta.env.VITE_API_BASE_URL?.trim() || (apiEnabled ? apiBaseUrl : "");
function bridgeUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value.replace(/\/$/, "");
  try {
    const parsed = new URL(value);
    const privateHost = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !(parsed.protocol === "https:" || parsed.protocol === "http:" && privateHost && (import.meta.env.DEV || import.meta.env.VITE_MOBILE_TEST === "true"))) return "";
    return parsed.origin + (parsed.pathname.replace(/\/$/, "") || "/api/v1");
  } catch { return ""; }
}
export const deviceBridgeConfigured = nativeDesktop ? !!(desktopConfig().bridge||desktopConfig().backend) : bundledMobile || !!bridgeUrl(bridgeAddress);
export const getDeviceBridgeBaseUrl = () => nativeDesktop ? desktopConfig().bridge||getApiBaseUrl() : bundledMobile ? getApiBaseUrl() : bridgeUrl(bridgeAddress);
