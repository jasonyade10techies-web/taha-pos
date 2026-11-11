import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiAuth,
  getAccessToken,
  refreshApiSession,
} from "../../lib/api/client";
import {
  cachedSession,
  cacheSession,
  clearReadCache,
} from "../../lib/mobile/read-cache";
import { useSessionStore } from "../../stores/session-store";
import { useMobilePreferences } from "../../stores/mobile-preferences-store";
import { useCameraStore } from "../../stores/camera-store";
import { ApiError } from "../../lib/api/client";

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  useEffect(() => {
    let alive = true,
      busy = false,
      sequence = 0,
      pending = false;
    const clear = () => {
      ++sequence;
      client.clear();
      useCameraStore.setState({ jobs: [] });
      useMobilePreferences.setState({ verifiedSession: false });
      useSessionStore.getState().resetAuth();
    };
    const refresh = async () => {
      if (busy) {
        pending = true;
        return;
      }
      busy = true;
      const run = sequence;
      try {
        const context = getAccessToken()
          ? await apiAuth.context()
          : await refreshApiSession();
        if (!alive || run !== sequence) return;
        if (!context) {
          clear();
          await clearReadCache();
          return;
        }
        if (
          useSessionStore.getState().profile?.id &&
          useSessionStore.getState().profile?.id !== context.profile?.id
        ) {
          window.TahaNative?.clearPendingPhotos?.();
          window.dispatchEvent(new Event("taha-private-photos-clear"));
          await clearReadCache();
          client.clear();
          useCameraStore.setState({ jobs: [] });
        }
        useSessionStore.getState().applyContext(context);
        useMobilePreferences.setState({ verifiedSession: true });
        await cacheSession(context);
      } catch (cause) {
        if (!alive || run !== sequence) return;
        useMobilePreferences.setState({ verifiedSession: false });
        if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
          clear();
          await clearReadCache();
          return;
        }
        const cached = await cachedSession();
        if (!alive || run !== sequence) return;
        if (cached?.profile?.status === "active")
          useSessionStore.getState().applyContext(cached);
        else
          useSessionStore
            .getState()
            .resetAuth(
              "error",
              "Connect to the shop to sign in. Cached access is not available on this phone.",
            );
      } finally {
        busy = false;
        if (pending && alive) {
          pending = false;
          void refresh();
        }
      }
    };
    const changed = () => {
      ++sequence;
      void refresh();
    };
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const expired = () => {
      clear();
      void clearReadCache();
    };
    void refresh();
    const timer = setInterval(resume, 60_000);
    window.addEventListener("taha-session-refresh", changed);
    window.addEventListener("taha-api-expired", expired);
    window.addEventListener("taha-app-resume", resume);
    window.addEventListener("online", resume);
    window.addEventListener("taha-session-clear", expired);
    return () => {
      alive = false;
      ++sequence;
      clearInterval(timer);
      window.removeEventListener("taha-session-refresh", changed);
      window.removeEventListener("taha-api-expired", expired);
      window.removeEventListener("taha-app-resume", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("taha-session-clear", expired);
    };
  }, [client]);
  return children;
}
