import { dataProvider, mockAuthEnabled, localDemoEnabled } from "./config";
import { localDashboard } from "./dashboard-source";
import { repositories } from "./repositories";
import {remoteDashboard} from "./supabase/dashboard";
import { useSessionStore } from "../stores/session-store";
import type { DashboardData } from "../types/dashboard";
import type {DateRange} from './dashboard-range';

function activeStore() {
  const { context, authStatus } = useSessionStore.getState();
  if (authStatus !== "authenticated" || !context?.store)
    throw new Error("An active branch session is required.");
  return context.store.id;
}
// Identity and branch are part of every cache key; identity changes also clear all cached business data.
export const queryKeys = {
  dashboard: (subject: string, store: string) =>
    [
      "dashboard",
      mockAuthEnabled ? "mock" : dataProvider,
      subject,
      store,
    ] as const,
  posProducts: (subject: string, store: string) =>
    [
      "pos",
      "products",
      mockAuthEnabled ? "mock" : dataProvider,
      subject,
      store,
    ] as const,
};
export const retailDataSource = {
  dashboard: async (range?:DateRange): Promise<DashboardData> => {
    activeStore();
    if (localDemoEnabled) return localDashboard(range);
    if (mockAuthEnabled)
      return (await import("../mocks/dashboard")).dashboardData;
    return remoteDashboard(range);
  },
  posProducts: async () => {
    activeStore();
    return localDemoEnabled
      ? repositories.products.pos()
      : mockAuthEnabled
        ? (await import("../mocks/products")).posProducts
        : repositories.products.pos();
  },
};
