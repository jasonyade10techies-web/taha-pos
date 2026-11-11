import Dexie, { type Table } from "dexie";
import { useSessionStore } from "../../stores/session-store";
import { getApiBaseUrl } from "../config";
import { nativeDesktop } from "../desktop/runtime";
import { sqliteCache } from "../desktop/database";
import { useSyncStore } from "../../stores/sync-store";
type Cached = { id: string; at: number; value: unknown };
class ReadCache extends Dexie {
  records!: Table<Cached, string>;
  constructor() {
    super("taha-counter-read-cache");
    this.version(1).stores({ records: "id,at" });
  }
}
const db = new ReadCache(),
  ttl = 8 * 60 * 60_000;
const key = (name: string) => {
  const state = useSessionStore.getState();
  return `${getApiBaseUrl()}|${state.context?.store?.id}|${state.profile?.id}|${name}`;
};
/** Only explicitly allowlisted, cost-free reads are cached. Authorization failures never fall back. */
export async function cachedCounterRead<T>(
  name: string,
  load: () => Promise<T>,
  preferLocal = false,
): Promise<T> {
  if (
    nativeDesktop &&
    (preferLocal || useSyncStore.getState().status === "OFFLINE")
  ) {
    if (name.startsWith("media-links:")) return {} as T;
    const value = await sqliteCache<T>(name);
    if (value !== null) return value;
  }
  if (nativeDesktop) {
    if (name.startsWith("media-links:")) {
      try {
        return await load();
      } catch (error) {
        if (
          typeof error === "object" &&
          error &&
          "status" in error &&
          Number(error.status) !== 0
        )
          throw error;
        return {} as T;
      }
    }
    try {
      const value = await load();
      await sqliteCache(name, value);
      return (
        name === "pos-products" ? await sqliteCache<T>(name) : value
      ) as T;
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "status" in error &&
        Number(error.status) !== 0
      )
        throw error;
      const value = await sqliteCache<T>(name);
      if (value === null) throw error;
      window.dispatchEvent(
        new CustomEvent("taha-cached-read", { detail: name }),
      );
      return value;
    }
  }
  const id = key(name);
  try {
    const value = await load();
    await db.records.put({ id, at: Date.now(), value });
    await db.records
      .where("at")
      .below(Date.now() - ttl)
      .delete();
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      navigator.onLine &&
      !/network|fetch|unreachable|timeout|offline|connection|shop server/i.test(
        message,
      )
    )
      throw error;
    const record = await db.records.get(id);
    if (!record || Date.now() - record.at > ttl) throw error;
    window.dispatchEvent(new CustomEvent("taha-cached-read", { detail: name }));
    return record.value as T;
  }
}
window.addEventListener("taha-session-clear", () => void db.records.clear());
