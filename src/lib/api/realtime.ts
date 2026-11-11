import { apiRequest } from "./client";
import { nativeDesktop } from "../desktop/runtime";
import { sqliteCache } from "../desktop/database";
import type { PosProductRow } from "../../types/database";
/** HTTPS is authoritative; notifications contain no business records or secrets. */
export function subscribeCounter(
  storeId: string,
  _terminalId: string,
  changed: (update?: {
    id?: string;
    terminalId?: string;
    status?: string;
  }) => void,
) {
  let cursor = "0",
    cursorLoaded = false,
    stopped = false,
    busy = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (stopped || busy) return;
    busy = true;
    let again = false;
    try {
      if (nativeDesktop && !cursorLoaded) {
        cursor = (await sqliteCache<string>("sync-cursor")) || "0";
        cursorLoaded = true;
      }
      const result = await apiRequest<{
        cursor: string;
        hasMore: boolean;
        changes: { id: string; resource: string }[];
      }>(`/stores/${storeId}/sync/changes?after=${cursor}`);
      if (nativeDesktop) {
        const ids = [
          ...new Set(
            result.changes
              .filter((c) => ["products", "stock"].includes(c.resource))
              .map((c) => c.id),
          ),
        ];
        if (ids.length) {
          const rows = await apiRequest<PosProductRow[]>(
            `/stores/${storeId}/sync/catalog?ids=${ids.join(",")}`,
          );
          const old = await sqliteCache<PosProductRow[]>(
            "pos-products",
            undefined,
            true,
          );
          if (old)
            await sqliteCache("pos-products", [
              ...old.filter((p) => !ids.includes(p.id)),
              ...rows,
            ]);
        }
      }
      cursor = result.cursor;
      if (nativeDesktop) await sqliteCache("sync-cursor", cursor);
      again = result.hasMore;
      if (result.changes.length) changed();
    } catch {
      /* Keep the cursor; transient outages must not lose changes. */
    } finally {
      busy = false;
      if (!stopped)
        timer = setTimeout(
          () => void poll(),
          again ? 100 : document.visibilityState === "visible" ? 4000 : 30000,
        );
    }
  };
  const resume = () => {
    clearTimeout(timer);
    void poll();
  };
  void poll();
  window.addEventListener("taha-remote-changed", resume);
  window.addEventListener("taha-app-resume", resume);
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", resume);
  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("taha-remote-changed", resume);
    window.removeEventListener("taha-app-resume", resume);
    window.removeEventListener("online", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
