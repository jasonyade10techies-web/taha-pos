import { create } from "zustand";
import { persist } from "zustand/middleware";
export const mobileTabs = [
  "Sales",
  "Home",
  "Activity",
  "Devices",
  "Products",
  "Inventory",
  "Reports",
  "Profile",
] as const;
export type MobileTab = (typeof mobileTabs)[number];
export const defaultMobileTabs: MobileTab[] = [
  "Home",
  "Activity",
  "Devices",
  "Profile",
];
interface Preferences {
  tabs: MobileTab[];
  saveToGallery: boolean;
  scannerMode: "auto" | "qr" | "barcode";
  offlineCache: boolean;
  verifiedSession: boolean;
  keyboardOpen: boolean;
  setTabs: (tabs: MobileTab[]) => void;
  setSaveToGallery: (enabled: boolean) => void;
  setOfflineCache: (enabled: boolean) => void;
}
export const useMobilePreferences = create<Preferences>()(
  persist(
    (set) => ({
      tabs: defaultMobileTabs,
      saveToGallery: false,
      scannerMode: "auto",
      offlineCache: true,
      verifiedSession: false,
      keyboardOpen: false,
      setTabs: (tabs) =>
        set({
          tabs: [...new Set(tabs)]
            .filter((tab) => mobileTabs.includes(tab))
            .slice(0, 4),
        }),
      setSaveToGallery: (saveToGallery) => set({ saveToGallery }),
      setOfflineCache: (offlineCache) => set({ offlineCache }),
    }),
    {
      name: "taha-staff-preferences",
      version: 1,
      partialize: (s) => ({
        tabs: s.tabs,
        saveToGallery: s.saveToGallery,
        scannerMode: s.scannerMode,
        offlineCache: s.offlineCache,
      }),
    },
  ),
);
