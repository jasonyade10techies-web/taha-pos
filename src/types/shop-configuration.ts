export interface ShopConfiguration {
  operatingMode: "owner-only" | "staff";
  setupCompleted: boolean;
  setupRequired?: boolean;
  setupStep: number;
  enabledFeatures: { credit: boolean; testItems: boolean; repairs: boolean; usedDevices: boolean; suppliers: boolean; mobileSales: boolean; website: boolean };
  storageLabels: { rack: string; shelf: string; box: string };
  quarantineLocationId: string;
  showCashierOnReceipt: boolean;
}
export const defaultShopConfiguration: ShopConfiguration = {
  operatingMode: "staff", setupCompleted: false, setupStep: 0,
  enabledFeatures: { credit: true, testItems: true, repairs: true, usedDevices: true, suppliers: true, mobileSales: true, website: false },
  storageLabels: { rack: "Rack", shelf: "Shelf", box: "Box" }, quarantineLocationId: "", showCashierOnReceipt: true,
};
export function shopConfiguration(value?: Partial<ShopConfiguration>): ShopConfiguration {
  return { ...defaultShopConfiguration, ...value, enabledFeatures: { ...defaultShopConfiguration.enabledFeatures, ...value?.enabledFeatures, website: false }, storageLabels: { ...defaultShopConfiguration.storageLabels, ...value?.storageLabels } };
}
export function visibleShopRoute(path: string, config: ShopConfiguration) {
  if (path.startsWith("/website") || path.startsWith("/repair-enquiries")) return false;
  if (config.operatingMode === "owner-only" && /^\/(employees|shifts)(\/|$)/.test(path)) return false;
  // Historic financial and customer accounts remain reachable even when new-credit features are hidden.
  if (!config.enabledFeatures.repairs && /^\/(services|repair-jobs)(\/|$)/.test(path)) return false;
  if (!config.enabledFeatures.usedDevices && /^\/(buy-device|purchased-devices)(\/|$)/.test(path)) return false;
  if (!config.enabledFeatures.suppliers && /^\/suppliers(\/|$)/.test(path)) return false;
  return true;
}
