import { useRepository } from "./use-repository";
import { repositories } from "../lib/repositories";
import { shopConfiguration } from "../types/shop-configuration";

export function useShopConfiguration() {
  const query = useRepository("shop-configuration", () => repositories.settings.get());
  const configuration = shopConfiguration(query.data?.shopConfiguration);
  return { configuration, ownerOnly: configuration.operatingMode === "owner-only", isPending: query.isPending, error: query.error };
}
