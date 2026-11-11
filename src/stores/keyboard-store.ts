import { create } from "zustand";

type KeyboardState = {
  open: boolean;
  mode: "numeric" | "full";
  enabled: boolean;
  modalDepth: number;
  enterModal: () => void;
  leaveModal: () => void;
  setOpen: (open: boolean, mode?: "numeric" | "full") => void;
  setEnabled: (enabled: boolean) => void;
};

export const useKeyboardStore = create<KeyboardState>((set) => ({
  open: false,
  mode: "full",
  enabled: true,
  modalDepth: 0,
  enterModal: () => set(s => ({ modalDepth: s.modalDepth + 1 })),
  leaveModal: () => set(s => ({ modalDepth: Math.max(0, s.modalDepth - 1) })),
  setOpen: (open, mode) => set((s) => ({ open, mode: mode ?? s.mode })),
  setEnabled: (enabled) => set({ enabled }),
}));
