import { invoke } from "@tauri-apps/api/core";
import { getApiBaseUrl } from "../config";
import { useSessionStore } from "../../stores/session-store";
import type { Sale } from "../../types/demo";
export const desktopScope = () => {
  const c = useSessionStore.getState().context;
  return `${getApiBaseUrl()}|${c?.store?.id}|${c?.profile?.id}`;
};
export const sqliteCache = <T>(name: string, value?: T, raw = false) =>
  invoke<T | null>("desktop_cache", {
    scope: desktopScope(),
    name,
    value: value ?? null,
    raw,
  });
export const sqliteDraft = <T>(value?: T) =>
  invoke<T | null>("desktop_draft", {
    scope: desktopScope(),
    value: value ?? null,
  });
export type OutboxItem = {
  id: string;
  type: "CASH_SALE" | "IMAGE_UPLOAD";
  payload: unknown;
  status: "PENDING" | "SYNCING" | "SYNCED" | "CONFLICT" | "FAILED";
  attempts: number;
  error?: string;
  nextAttempt: number;
};
export const sqliteOutbox = (
  id?: string,
  status?: OutboxItem["status"],
  error?: string,
  receipt?: Sale,
) =>
  invoke<OutboxItem[]>("desktop_outbox", {
    scope: desktopScope(),
    id: id ?? null,
    status: status ?? null,
    error: error ?? null,
    receipt: receipt ?? null,
  });
export const sqliteReceipts = () =>
  invoke<Sale[]>("desktop_receipts", { scope: desktopScope() });
export const sqliteCashRegistered=(id:string)=>invoke('desktop_outbox',{scope:desktopScope(),id,status:'REGISTERED',error:null,receipt:null});
