import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Branch, ThemePreference } from "../types/session";
import { defaultAppearance, migrateAppearance, type Appearance } from "../lib/appearance";
import { getTerminalId } from "../lib/terminal-identity";

interface UiState {
  sidebarCollapsed: boolean;
  theme: ThemePreference;
  branch: Branch;
  terminalId: string;
  customerDisplayEnabled: boolean;
  customerDisplayFullscreen: boolean;
  keyboardEnabled: boolean;
  keyboardOpenOnTouch: boolean;
  keyboardNumericAmounts: boolean;
  keyboardSize: "Compact" | "Large";
  setKeyboardPreferences: (prefs: {keyboardOpenOnTouch?:boolean;keyboardNumericAmounts?:boolean;keyboardSize?:"Compact"|"Large"}) => void;
  appearance: Appearance;
  previewAppearance: Appearance | null;
  setAppearance: (appearance: Appearance) => void;
  previewColors: (previewAppearance: Appearance | null) => void;
  toggleSidebar: () => void;
  setTheme: (theme: ThemePreference) => void;
  setBranch: (branch: Branch) => void;
  setCustomerDisplayEnabled: (enabled: boolean) => void;
  setCustomerDisplayFullscreen: (enabled: boolean) => void;
  setKeyboardEnabled: (enabled: boolean) => void;
}
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "light",
      branch: { id: "main", name: "Main Branch" },
      terminalId: getTerminalId(),
      customerDisplayEnabled: true,
      customerDisplayFullscreen: false,
      keyboardEnabled: true,
      keyboardOpenOnTouch: false,
      keyboardNumericAmounts: true,
      keyboardSize: "Compact",
      setKeyboardPreferences: prefs => set(prefs),
      appearance: defaultAppearance,
      previewAppearance: null,
      setAppearance: (appearance) => set({ appearance, previewAppearance: null }),
      previewColors: (previewAppearance) => set({ previewAppearance }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setBranch: (branch) => set({ branch }),
      setCustomerDisplayEnabled: (customerDisplayEnabled) => set({ customerDisplayEnabled }),
      setCustomerDisplayFullscreen: (customerDisplayFullscreen) => set({ customerDisplayFullscreen }),
      setKeyboardEnabled: (keyboardEnabled) => set({ keyboardEnabled }),
    }),
    {
      name: "taha-pos-ui",
      version: 1,
      merge: (saved, current) => {
        const previous = saved as Partial<UiState>;
        return {...current,...previous,appearance:migrateAppearance(previous.appearance ?? current.appearance),terminalId:getTerminalId()};
      },
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        branch: s.branch,
        terminalId: s.terminalId,
        customerDisplayEnabled: s.customerDisplayEnabled,
        customerDisplayFullscreen: s.customerDisplayFullscreen,
        keyboardEnabled: s.keyboardEnabled,
        keyboardOpenOnTouch: s.keyboardOpenOnTouch,
        keyboardNumericAmounts: s.keyboardNumericAmounts,
        keyboardSize: s.keyboardSize,
        appearance: s.appearance,
      }),
    },
  ),
);
