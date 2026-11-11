import { apiRequest, ApiError } from "../api/client";
import { cacheRead, cachedRead, clearReadCache } from "./read-cache";
import { useSessionStore } from "../../stores/session-store";
import { useMobilePreferences } from "../../stores/mobile-preferences-store";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import type {
  PosProductRow,
  LocationRow,
  ProductRow,
} from "../../types/database";
import type { DashboardData } from "../../types/dashboard";
import { permitted } from "../permissions";
import { bundledMobile } from "./runtime";
import type { SalePage } from "../../types/transactions";
export const staffStorePath = () =>
  `/stores/${useSessionStore.getState().context?.store?.id || ""}`;
function cacheSafe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cacheSafe);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/(purchase.?cost|supplier.?cost|valuation|profit|margin|token|imageUrl|thumbnailUrl)/i.test(
              key,
            ),
        )
        .map(([key, v]) => [key, cacheSafe(v)]),
    );
  if (typeof value === "string" && /[?&]token=/.test(value)) return "";
  return value;
}
export async function mobileRead<T>(
  path: string,
): Promise<{ data: T; cached: boolean }> {
  const verified = useMobilePreferences.getState().verifiedSession,
    identity = useSessionStore.getState().profile?.id,
    shop = useShopConnectionStore.getState().baseUrl;
  if (verified && navigator.onLine) {
    try {
      const data = await apiRequest<T>(staffStorePath() + path);
      if (
        identity !== useSessionStore.getState().profile?.id ||
        shop !== useShopConnectionStore.getState().baseUrl
      )
        throw new Error("Your session changed. Open this screen again.");
      await cacheRead(path, cacheSafe(data));
      return { data, cached: false };
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
        await clearReadCache();
        throw cause;
      }
      const cached = await cachedRead<T>(path);
      if (cached) return { data: cached, cached: true };
      throw cause;
    }
  }
  const cached = await cachedRead<T>(path);
  if (cached) return { data: cached, cached: true };
  throw new Error(
    "This information has not been saved on this phone yet. Reconnect to the shop to load it.",
  );
}
export function requireMobileOnline() {
  if (
    !useMobilePreferences.getState().verifiedSession ||
    (bundledMobile &&
      useShopConnectionStore.getState().connectionStatus !== "connected")
  )
    throw new Error("Reconnect to the shop before making this change.");
}
export const staffService = {
  products: () => mobileRead<PosProductRow[]>("/products/pos"),
  product: (id: string) =>
    mobileRead<ProductRow>(`/products/${encodeURIComponent(id)}`),
  locations: () => mobileRead<LocationRow[]>("/locations"),
  balances: () =>
    mobileRead<{ product_id: string; location_id: string; quantity: number }[]>(
      "/inventory/balances",
    ),
  dashboard: () =>
    mobileRead<{
      summary: {
        sales: number;
        cash: number;
        creditGiven: number;
        digital: number;
        returns: number;
      } | null;
      profit: number | null;
      chart: DashboardData["chart"];
      activity: DashboardData["activity"];
      credit: DashboardData["credit"];
    }>("/dashboard"),
  sales: (reference?: string) =>
    mobileRead<SalePage>(
      "/sales" +
        (reference
          ? "?search=" + encodeURIComponent(reference) + "&limit=100"
          : ""),
    ),
  allow: (key: Parameters<typeof permitted>[2]) => {
    const s = useSessionStore.getState();
    return permitted(s.profile, s.permissions, key);
  },
  async updateProfile(fullName: string, phone: string) {
    requireMobileOnline();
    return apiRequest(`${staffStorePath()}/profile`, {
      method: "PATCH",
      body: JSON.stringify({ fullName, phone }),
    });
  },
};
