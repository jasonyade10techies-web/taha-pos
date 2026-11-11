import { create } from "zustand";
import type { OutboxItem } from "../lib/desktop/database";
export type SyncState =
  "ONLINE" | "OFFLINE" | "SYNCING" | "SYNC ERROR" | "PENDING CHANGES";
export const useSyncStore = create<{
  status: SyncState;
  pending: OutboxItem[];
  lastSync: number | null;
  error: string;
  retry: () => void;
}>(() => ({
  status: "ONLINE",
  pending: [],
  lastSync: null,
  error: "",
  retry: () => window.dispatchEvent(new Event("taha-sync-retry")),
}));
