import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/session-store";
import { useCartStore } from "../../stores/cart-store";
import { useUiStore } from "../../stores/ui-store";
import { useSyncStore } from "../../stores/sync-store";
import { nativeDesktop } from "../../lib/desktop/runtime";
import {
  sqliteDraft,
  sqliteOutbox,
  sqliteReceipts,
  sqliteCashRegistered,
} from "../../lib/desktop/database";
import { apiEnabled } from "../../lib/config";
import {
  apiRequest,
  ApiError,
  getAccessToken,
  refreshApiSession,
} from "../../lib/api/client";
import { apiRepositories } from "../../lib/api/repositories";
import { refreshPosCatalogue } from "../../lib/api/catalog-repositories";
import type { Sale } from "../../types/demo";
import type { CartItem } from "../../types/product";
import { desktopImage, acknowledgeImage } from "../../lib/desktop/images";
import { apiStoreMedia } from "../../lib/api/media";
import {cashRecords} from '../../lib/desktop/reconciliation';
let synchronizationRunning=false;

export function DesktopSync() {
  const profile = useSessionStore((s) => s.profile),
    client = useQueryClient();
  useEffect(() => {
    if (
      !nativeDesktop ||
      !apiEnabled ||
      !profile ||
      location.hash.includes("/customer-display")
    )
      return;
    let stopped = false,
      busy = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      draftTimer: ReturnType<typeof setTimeout> | undefined,
      restored = false,
      prepared = false,
      lastGrant = 0;
    const restore = async () => {
      if (restored) return;
      try {
        const draft = await sqliteDraft<{
          items: CartItem[];
          cartId: string;
          checkoutId: string;
          customerId: string;
          couponCode: string;
          couponDiscount: number;
        }>();
        const receipts = await sqliteReceipts();
        if (
          !stopped &&
          draft &&
          !useCartStore.getState().items.length &&
          !receipts.some(
            (s) =>
              s.offlineId === draft.checkoutId || s.id === draft.checkoutId,
          )
        )
          useCartStore.setState(draft);
      } finally {
        restored = true;
      }
    };
    const run = async () => {
      if (stopped || busy) return;
      if(synchronizationRunning){clearTimeout(timer);timer=setTimeout(()=>void run(),1000);return;}
      busy = true;
      synchronizationRunning=true;
      try {
        await restore();
        const pending = await sqliteOutbox();
        useSyncStore.setState({
          pending,
          status: pending.length ? "PENDING CHANGES" : "ONLINE",
        });
        await apiRequest("/health");
        if (!getAccessToken()) await refreshApiSession();
        for (const item of pending) {
          if (stopped) break;
          if (item.status === "CONFLICT" || item.nextAttempt > Date.now())
            continue;
          useSyncStore.setState({ status: "SYNCING" });
          await sqliteOutbox(item.id, "SYNCING");
          try {
            if (item.type === "IMAGE_UPLOAD") {
              const image = await desktopImage(item.id),
                payload = item.payload as { kind: string };
              if (!image.path && image.body) {
                useSyncStore.setState({ status: "SYNCING" });
                const path = await apiStoreMedia(
                  `data:${image.mime || "image/jpeg"};base64,${image.body}`,
                  payload.kind,
                  "",
                  undefined,
                  undefined,
                  "",
                  payload.kind === "product",
                  item.id,
                );
                await acknowledgeImage(item.id, path);
              }
              await sqliteOutbox(item.id, "SYNCED");
              continue;
            }
            const storeId=useSessionStore.getState().context?.store?.id;
            await apiRequest(`/stores/${storeId}/sync/cash-captures`,{method:'POST',body:JSON.stringify(item.payload)});
            await sqliteCashRegistered(item.id);
            const sale = await apiRequest<Sale>(
              `/stores/${useSessionStore.getState().context?.store?.id}/sync/sales`,
              { method: "POST", body: JSON.stringify(item.payload) },
            );
            await sqliteOutbox(item.id, "SYNCED", undefined, {
              ...sale,
              offlineId: item.id,
              syncStatus: "SYNCED",
            });
          } catch (cause) {
            const conflict =
              cause instanceof ApiError &&
              cause.status > 0 &&
              cause.status < 500;
            await sqliteOutbox(
              item.id,
              conflict ? "CONFLICT" : "FAILED",
              conflict
                ? `Needs owner review. ${cause instanceof Error?cause.message:'Prices, permissions, tax or stock may have changed.'}`
                : cause instanceof ApiError&&cause.status===0
                  ? "The shop is unreachable. This change is retained locally and will retry automatically."
                  : "The server could not post this receipt. It is retained locally; retry is available.",
            );
            if (!conflict) throw cause;
          }
        }
        const current=useSessionStore.getState();
        if(!stopped&&current.profile&&(current.profile.role==='owner'||current.profile.role==='manager'&&current.permissions.includes('sync.reconcile_cash')))await cashRecords().catch(()=>undefined);
        const remaining = await sqliteOutbox();
        useSyncStore.setState({
          pending: remaining,
          status: remaining.some((i) => i.status === "CONFLICT")
            ? "SYNC ERROR"
            : remaining.length
              ? "PENDING CHANGES"
              : "ONLINE",
          lastSync: Date.now(),
          error: "",
        });
        const context = useSessionStore.getState().context;
        if (
          context?.profile &&
          !context.terminal &&
          Date.now() - lastGrant > 3600000
        ) {
          await apiRequest(`/stores/${context.store?.id}/sync/offline-grant`, {
            method: "POST",
            body: JSON.stringify({
              terminalId: useUiStore.getState().terminalId,
            }),
          });
          lastGrant = Date.now();
        }
        if (!prepared || pending.length) {
          await Promise.all([
            refreshPosCatalogue(),
            apiRepositories.settings.get(),
            apiRepositories.payments.list(),
            apiRepositories.customers.list(),
            apiRepositories.locations.list(),
          ]);
          prepared = true;
          void client.invalidateQueries({ queryKey: ["pos", "products"] });
        }
        if (pending.length) void client.invalidateQueries();
      } catch (cause) {
        useSyncStore.setState({
          status: cause instanceof ApiError && cause.status === 0 ? "OFFLINE" : "SYNC ERROR",
          error:
            cause instanceof Error
              ? cause.message
              : "Shop connection unavailable.",
        });
      } finally {
        busy = false;
        synchronizationRunning=false;
        if (!stopped)
          timer = setTimeout(
            () => void run(),
            document.visibilityState === "visible" ? 15000 : 60000,
          );
      }
    };
    const retry = () => {
      clearTimeout(timer);
      void run();
    };
    const unsubscribe = useCartStore.subscribe((s) => {
      if (!restored) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        if (stopped) return;
        const items = s.items.map((i) => ({ ...i, approval: undefined }));
        void sqliteDraft({
          items,
          cartId: s.cartId,
          checkoutId: s.checkoutId,
          customerId: s.customerId,
          coupon: false,
          couponCode: "",
          couponDiscount: 0,
        }).catch(() => undefined);
      }, 150);
    });
    void run();
    window.addEventListener("taha-sync-retry", retry);
    window.addEventListener("online", retry);
    window.addEventListener("taha-app-resume", retry);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(draftTimer);
      unsubscribe();
      window.removeEventListener("taha-sync-retry", retry);
      window.removeEventListener("online", retry);
      window.removeEventListener("taha-app-resume", retry);
    };
  }, [profile, client]);
  return null;
}
