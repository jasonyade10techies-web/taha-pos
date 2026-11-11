import Dexie, { type Table } from "dexie";
import type { SessionContext } from "../../types/auth";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import { useSessionStore } from "../../stores/session-store";
import { useMobilePreferences } from "../../stores/mobile-preferences-store";
type Record = {
  key: string;
  shop: string;
  subject: string;
  at: number;
  value: unknown;
};
class StaffCache extends Dexie {
  records!: Table<Record, string>;
  constructor() {
    super("taha-staff-read-cache");
    this.version(1).stores({ records: "key,shop,subject,at" });
  }
}
const db = new StaffCache(),
  ttl = 8 * 60 * 60_000;
let cacheEpoch = 0;
const shop = () => useShopConnectionStore.getState().baseUrl;
const subject = () => useSessionStore.getState().profile?.id || "";
const key = (name: string, user = subject()) => `${shop()}|${user}|${name}`;
/** Read-only data is scoped to shop/user, bounded in age, and cleared on logout/shop change.
 * Cached permissions describe prior visibility; they never create an authenticated API token. */
export async function cacheRead<T>(name: string, value: T, user = subject()) {
  if (!useMobilePreferences.getState().offlineCache || !shop() || !user) return;
  const epoch = cacheEpoch,
    record = {
      key: key(name, user),
      shop: shop(),
      subject: user,
      at: Date.now(),
      value,
    };
  await db.transaction("rw", db.records, async () => {
    if (epoch === cacheEpoch) await db.records.put(record);
  });
  await db.records
    .where("at")
    .below(Date.now() - ttl)
    .delete();
}
export async function cachedRead<T>(
  name: string,
  user = subject(),
): Promise<T | undefined> {
  if (!useMobilePreferences.getState().offlineCache) return;
  const epoch = cacheEpoch,
    result = await db.records.get(key(name, user));
  return epoch === cacheEpoch && result && Date.now() - result.at < ttl
    ? (result.value as T)
    : undefined;
}
export async function cacheSession(context: SessionContext) {
  if (!context.profile) return;
  const safe = {
    ...context,
    profile: {
      ...context.profile,
      avatar_url: context.profile.avatar_url?.includes("?")
        ? null
        : context.profile.avatar_url,
    },
    counter_expires_at: null,
  };
  await cacheRead("session", safe, "last-session");
}
export const cachedSession = () =>
  cachedRead<SessionContext>("session", "last-session");
export async function clearReadCache() {
  ++cacheEpoch;
  await db.records.clear();
}
window.addEventListener("taha-session-clear", () => void clearReadCache());
window.addEventListener("taha-shop-changed", () => void clearReadCache());
