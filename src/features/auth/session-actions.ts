import { mockAuthEnabled } from "../../lib/config";
import { useSessionStore, mockContext } from "../../stores/session-store";
import { useCartStore } from "../../stores/cart-store";
import { setCounterToken } from "../../lib/supabase/client";
import { authService } from "./services/auth-service";
import { counterService } from "./services/counter-service";
import type { QueryClient } from "@tanstack/react-query";
import { useCameraStore } from "../../stores/camera-store";
import { resetDisplayToCart } from "../../hooks/use-customer-display";

export function clearWorkspace(queryClient: QueryClient) {
  void queryClient.cancelQueries();
  queryClient.clear();
  useCartStore.getState().clear();
  useCameraStore.setState({ jobs: [] });
  resetDisplayToCart();
  useSessionStore.getState().setCheckoutOpen(false);
  useSessionStore.getState().setCommandOpen(false);
}
export function mockSignIn() {
  if (!mockAuthEnabled)
    throw new Error("Mock sign-in is disabled in Supabase mode.");
  sessionStorage.setItem("taha-demo-employee", "owner-1");
  window.dispatchEvent(new Event("taha-session-refresh"));
  sessionStorage.removeItem("taha-pos-dev-signed-out");
  useSessionStore.getState().applyContext(mockContext);
}
export async function signOut(queryClient: QueryClient) {
  const terminal = useSessionStore.getState().terminal;
  window.dispatchEvent(new Event("taha-session-clear"));
  clearWorkspace(queryClient);
  setCounterToken(null);
  useSessionStore.getState().resetAuth();
  if (mockAuthEnabled)
    sessionStorage.setItem("taha-pos-dev-signed-out", "true");
  else {
    let failure: unknown;
    if (terminal) {
      try {
        await counterService.lock();
      } catch (cause) {
        failure = cause;
      }
    }
    try {
      await authService.signOut();
    } catch (cause) {
      failure ??= cause;
    }
    if (failure) throw failure;
  }
}
export async function lockCounter(queryClient: QueryClient) {
  window.dispatchEvent(new Event("taha-session-clear"));
  useSessionStore.getState().resetAuth("counter-locked");
  clearWorkspace(queryClient);
  try {
    await counterService.lock();
  } finally {
    useSessionStore.getState().resetAuth("counter-locked");
  }
}
