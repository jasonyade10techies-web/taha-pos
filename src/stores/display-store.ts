import { create } from "zustand";

// Display identifiers and heartbeats are ephemeral. No cart or payment information is persisted.
export const useDisplayStore = create<{
  lastSeen: number;
  displaySessionId: string;
  connected: boolean;
  heartbeat: (id: string) => void;
  expire: () => void;
}>((set) => ({
  lastSeen: 0,
  displaySessionId: "",
  connected: false,
  heartbeat: (displaySessionId) => set({ lastSeen: Date.now(), displaySessionId, connected: true }),
  expire: () => set((s) => ({ connected: Date.now() - s.lastSeen < 8000 })),
}));
