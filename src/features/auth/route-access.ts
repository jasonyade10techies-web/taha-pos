import type { PermissionKey, Profile } from "../../types/auth";
import { permitted } from "./services/permission-service";
export const routePermissions: Record<string, PermissionKey[]> = {
  "/dashboard": ["sales.view", "reports.view", "inventory.view"],
  "/pos": ["sales.create"],
  "/transactions": ["sales.view"],
  "/sale-complete": ["sales.create", "sales.view"],
  "/returns": ["returns.create", "returns.approve"],
  "/products": ["inventory.view"],
  "/inventory": ["inventory.view"],
  "/locations": ["inventory.view"],
  "/stock-receiving": ["inventory.receive"],
  "/transfers": ["inventory.transfer"],
  "/low-stock": ["inventory.view"],
  "/services": ["products.edit", "repair.services.manage", "services.save_catalog"],
  "/repair-jobs": ["sales.create", "repairs.view", "repairs.create", "repairs.edit"],
  "/customers": ["customers.view", "sales.create", "credit.create", "credit.receive_payment"],
  "/credit": ["credit.create", "credit.receive_payment"],
  "/out-for-test": ["inventory.transfer"],
  "/buy-device": ["devices.buy_used"],
  "/purchased-devices": ["devices.buy_used"],
  "/suppliers": ["inventory.receive"],
  "/employees": ["employees.view", "employees.manage"],
  "/shifts": ["shifts.manage"],
  "/coupons": ["settings.manage"],
  "/payments": ["payments.approve_electronic", "payments.reverse", "settings.manage"],
  "/reports": ["reports.view"],
  "/audit-log": ["audit.view"],
  "/website-products": ["products.edit"],
  "/repair-enquiries": ["website.enquiries"],
  "/settings": ["settings.manage", "appearance.customize", "devices.pair", "sync.reconcile_cash"],
};
export function canOpenRoute(
  path: string,
  profile: Profile | null,
  permissions: PermissionKey[],
) {
  path = path.split(/[?#]/)[0];
  if (path === "/profile" || path === "/mobile-camera") return profile?.status === "active";
  if (path === "/products/new" || path === "/products/import")
    return permitted(profile, permissions, "products.create");
  if (/^\/products\/[^/]+\/edit$/.test(path))
    return permitted(profile, permissions, "products.edit");
  const root = "/" + path.split("/")[1];
  const aliases: Record<string, string> = {
    "/stock": "/inventory",
    "/payment-methods": "/payments",
  };
  const keys = routePermissions[aliases[root] || root];
  return Boolean(keys?.some((key) => permitted(profile, permissions, key)));
}
export function homeRoute(
  profile: Profile | null,
  permissions: PermissionKey[],
) {
  return (
    Object.keys(routePermissions).find((path) =>
      canOpenRoute(path, profile, permissions),
    ) ?? "/profile"
  );
}
