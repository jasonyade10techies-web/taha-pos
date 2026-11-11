export type ApplicationRole = "owner" | "manager" | "employee";
export const permissionKeys = [
  "sales.create",
  "sales.view",
  "sales.void",
  "pricing.discount_within_range",
  "pricing.override_minimum",
  "credit.create",
  "credit.receive_payment",
  "credit.override_limit",
  "payments.approve_electronic",
  "payments.reverse",
  "inventory.view",
  "inventory.receive",
  "inventory.adjust",
  "inventory.transfer",
  "products.create",
  "products.edit",
  "products.archive",
  "costs.view_purchase_cost",
  "profit.view",
  "returns.create",
  "returns.approve",
  "devices.buy_used",
  "reports.view",
  "reports.export",
  "shifts.manage",
  "employees.view",
  "employees.manage",
  "employees.permissions",
  "website.enquiries",
  "settings.manage",
  "audit.view",
  "sync.reconcile_cash",
  "customers.view", "customers.create", "customers.edit", "customers.credit",
  "services.create_custom", "services.save_catalog", "media.upload", "media.delete",
  "services.consume_inventory",
  "devices.pair", "camera.request", "appearance.customize",
  "repair.services.manage", "repairs.view", "repairs.create", "repairs.edit",
] as const;
export type PermissionKey = (typeof permissionKeys)[number];
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: ApplicationRole;
  status: "active" | "inactive";
}
export interface StoreSummary {
  id: string;
  name: string;
  branch_name: string;
}
export interface SessionContext {
  companion?:{storeId:string;terminalId:string;deviceId:string;scope:'camera'};
  profile: Profile | null;
  permissions: PermissionKey[];
  store: StoreSummary | null;
  terminal: boolean;
  counter_expires_at: string | null;
}
export interface CounterEmployee {
  id: string;
  full_name: string;
  role: ApplicationRole;
  avatar_url: string | null;
}
export interface PinVerification {
  ok: boolean;
  token?: string;
  expires_at?: string;
  session_id?: string;
  message?: string;
  retry_after?: number;
}
export type AuthStatus =
  | "loading"
  | "anonymous"
  | "authenticated"
  | "counter-locked"
  | "denied"
  | "error";
