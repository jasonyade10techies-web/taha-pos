import { requireSupabase } from "./client";
import { useSessionStore } from "../../stores/session-store";
import { permitted } from "../../features/auth/services/permission-service";
import type { Database } from "../../types/database";
import type { PermissionKey } from "../../types/auth";

export function activeStore() {
  const s = useSessionStore.getState();
  if (s.authStatus !== "authenticated" || !s.context?.store)
    throw new Error("Sign in to an active branch to continue.");
  return s.context.store.id;
}
export function allowed(key: PermissionKey) {
  const s = useSessionStore.getState();
  return permitted(s.profile, s.permissions, key);
}
export function databaseError(error: unknown): Error {
  const value = error as { code?: string; message?: string };
  const code = value?.code;
  if (code === "42501") {
    window.dispatchEvent(new Event("taha-session-refresh"));
    return new Error(
      "Access denied. Your current account does not have permission.",
    );
  }
  if (code === "40001")
    return new Error(
      "This record or stock balance changed. Reload and try again.",
    );
  if (code === "23505")
    return new Error(
      "This operation was already recorded or conflicts with another record. Reload to check its status.",
    );
  if (code === "P0001" && /Insufficient stock/i.test(value.message ?? ""))
    return new Error("There is not enough stock at the source location.");
  if (code === "22023" || code === "P0001")
    return new Error(value.message ?? "Check the transaction values and try again.");
  if (
    ["22023", "23514", "23503", "22P02", "22007", "23502", "22003"].includes(
      code ?? "",
    )
  )
    return new Error(
      "Check the values and active product, supplier, and Rack → Shelf → Box selections. Empty locations are required for archive.",
    );
  if (code === "PGRST301" || code === "PGRST302" || code === "401") {
    window.dispatchEvent(new Event("taha-session-refresh"));
    return new Error("Your session expired. Sign in again.");
  }
  return new Error(
    "The backend could not complete this request. Check your connection and try again.",
  );
}
export async function result<T>(
  request: PromiseLike<{ data: T; error: unknown }>,
) {
  const { data, error } = await request;
  if (error) throw databaseError(error);
  return data;
}
type Functions = Database["public"]["Functions"];
export async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const next = (await result(page(from, from + 499))) ?? [];
    rows.push(...next);
    if (next.length < 500) return rows;
  }
}
export async function rpc<N extends keyof Functions>(
  name: N,
  args: Functions[N]["Args"],
): Promise<Functions[N]["Returns"]> {
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) throw databaseError(error);
  if (!/^(get_|list_|quote_|transaction_data)/.test(name))
    window.dispatchEvent(new Event("taha-remote-changed"));
  return data as unknown as Functions[N]["Returns"];
}
