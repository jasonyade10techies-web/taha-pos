import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { apiEnabled, mockAuthEnabled, localDemoEnabled } from "../../lib/config";
import { initializeDemo, repositories } from "../../lib/repositories";
import { mockContext } from "../../stores/session-store";
import { useCartStore } from "../../stores/cart-store";
import { supabase, setCounterToken } from "../../lib/supabase/client";
import { useSessionStore } from "../../stores/session-store";
import { useUiStore } from "../../stores/ui-store";
import { profileService } from "./services/profile-service";
import { authService } from "./services/auth-service";
import { clearWorkspace, mockSignIn } from "./session-actions";

import { ApiAuthProvider } from "./api-auth-provider";
export function AuthProvider({ children }: { children: ReactNode }) {
  // The native customer window has event permissions only; never request staff credentials.
  if(isTauri()&&location.hash.includes('/customer-display'))return children;
  return apiEnabled ? <ApiAuthProvider>{children}</ApiAuthProvider> : <ExistingAuthProvider>{children}</ExistingAuthProvider>;
}
function ExistingAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (localDemoEnabled && !mockAuthEnabled) {
      useSessionStore
        .getState()
        .resetAuth(
          "error",
          "Local Demo mode requires VITE_USE_MOCK_AUTH=true. Supabase mode requires it to be false.",
        );
      return;
    }
    if (localDemoEnabled) {
      let alive = true;
      let generation = 0;
      const refresh = async () => {
        const run = ++generation;
        await initializeDemo();
        if (!alive) return;
        if (sessionStorage.getItem("taha-pos-dev-signed-out") === "true") {
          useSessionStore.getState().resetAuth();
          return;
        }
        if (
          window.location.pathname !== "/customer-display" &&
          !window.location.hash.startsWith("#/customer-display") &&
          !sessionStorage.getItem("taha-demo-basket")
        ) {
          sessionStorage.setItem("taha-demo-basket", "true");
          const products = await repositories.products.pos();
          if (!alive) return;
          for (const id of ["p2", "p3", "p5", "p4"]) {
            const product = products.find((p) => p.id === id);
            if (product) {
              useCartStore.getState().add(product);
              if (id === "p4") useCartStore.getState().changeQuantity(id, 2);
            }
          }
        }
        const employee = await repositories.employees.get(
          sessionStorage.getItem("taha-demo-employee") || "owner-1",
        );
        if (!alive) return;
        const settings = await repositories.settings.get();
        if (!alive || run !== generation) return;
        if (employee) {
          useSessionStore.getState().applyContext({
            ...mockContext,
            profile: employee,
            permissions: employee.permissions,
            store: {
              ...mockContext.store!,
              name: settings.storeName,
              branch_name: settings.branch,
            },
          });
          useUiStore
            .getState()
            .setBranch({ id: mockContext.store!.id, name: settings.branch });
        } else useSessionStore.getState().resetAuth();
      };
      const changed = () => {
        void queryClient.invalidateQueries();
        void refresh().catch(() =>
          useSessionStore
            .getState()
            .resetAuth(
              "error",
              "Unable to reload local employee access. Please retry.",
            ),
        );
      };
      void refresh().catch(() =>
        useSessionStore
          .getState()
          .resetAuth(
            "error",
            "Browser storage is unavailable. Enable IndexedDB to use the local prototype.",
          ),
      );
      window.addEventListener("taha-demo-changed", changed);
      window.addEventListener("taha-session-refresh", changed);
      return () => {
        alive = false;
        window.removeEventListener("taha-demo-changed", changed);
        window.removeEventListener("taha-session-refresh", changed);
      };
    }
    if (mockAuthEnabled) {
      if (sessionStorage.getItem("taha-pos-dev-signed-out") === "true")
        useSessionStore.getState().resetAuth();
      else mockSignIn();
      return;
    }
    if (!supabase) {
      useSessionStore.getState().resetAuth();
      return;
    }
    const client = supabase;
    let disposed = false;
    let generation = 0;
    let authenticatedUser: string | null = null;
    let expiration: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      const run = ++generation;
      try {
        const {
          data: { session },
          error,
        } = await client.auth.getSession();
        if (disposed || run !== generation) return;
        if (error || !session) {
          authenticatedUser = null;
          setCounterToken(null);
          clearWorkspace(queryClient);
          useSessionStore.getState().resetAuth();
          return;
        }
        if (authenticatedUser !== session.user.id) {
          authenticatedUser = session.user.id;
          setCounterToken(null);
          clearWorkspace(queryClient);
          useSessionStore.getState().resetAuth("loading");
        }
        const context = await profileService.context();
        if (disposed || run !== generation) return;
        const previous = useSessionStore.getState();
        if (
          previous.profile?.id !== context.profile?.id ||
          JSON.stringify(previous.permissions) !==
            JSON.stringify(context.permissions) ||
          previous.context?.store?.id !== context.store?.id
        )
          clearWorkspace(queryClient);
        useSessionStore.getState().applyContext(context);
        if (context.store)
          useUiStore.getState().setBranch({
            id: context.store.id,
            name: context.store.branch_name,
          });
        clearTimeout(expiration);
        if (context.counter_expires_at)
          expiration = setTimeout(
            () => {
              setCounterToken(null);
              clearWorkspace(queryClient);
              useSessionStore.getState().resetAuth("counter-locked");
              void refresh();
            },
            Math.max(0, Date.parse(context.counter_expires_at) - Date.now()),
          );
      } catch {
        if (!disposed && run === generation) {
          clearWorkspace(queryClient);
          useSessionStore
            .getState()
            .resetAuth(
              "error",
              "Your access could not be verified. Check your connection and try again.",
            );
        }
      }
    };
    // Do not await Supabase calls inside this callback: the SDK holds its session lock there.
    const invalidate = () => {
      generation++;
      clearTimeout(expiration);
    };
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      invalidate();
      if (event === "SIGNED_OUT" || !session) {
        authenticatedUser = null;
        setCounterToken(null);
        clearWorkspace(queryClient);
        useSessionStore.getState().resetAuth();
      } else if (authenticatedUser && authenticatedUser !== session.user.id) {
        authenticatedUser = null;
        setCounterToken(null);
        clearWorkspace(queryClient);
        useSessionStore.getState().resetAuth("loading");
      }
      queueMicrotask(() => {
        if (!disposed) void refresh();
      });
    });
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    const focused = () => void refresh();
    window.addEventListener("focus", focused);
    window.addEventListener("taha-session-refresh", focused);
    window.addEventListener("taha-session-clear", invalidate);
    let unlisten: (() => void) | undefined;
    if (isTauri())
      void import("@tauri-apps/plugin-deep-link")
        .then(async ({ getCurrent, onOpenUrl }) => {
          const processUrls = async (urls: string[]) => {
            for (const url of urls) {
              try {
                await authService.exchangeNativeCode(url);
              } catch {
                if (!disposed)
                  useSessionStore
                    .getState()
                    .resetAuth(
                      "error",
                      "Google authorization could not be completed. Please sign in again.",
                    );
              }
            }
          };
          if (disposed) return;
          unlisten = await onOpenUrl((urls) => {
            void processUrls(urls);
          });
          if (disposed) {
            unlisten();
            return;
          }
          const urls = await getCurrent();
          if (urls) await processUrls(urls);
        })
        .catch(() => {
          /* Email/password remains available if native OAuth registration is unavailable. */
        });
    return () => {
      disposed = true;
      generation++;
      subscription.unsubscribe();
      clearInterval(interval);
      clearTimeout(expiration);
      unlisten?.();
      window.removeEventListener("focus", focused);
      window.removeEventListener("taha-session-refresh", focused);
      window.removeEventListener("taha-session-clear", invalidate);
    };
  }, [queryClient]);
  return children;
}
