import type {
  Profile,
  CounterEmployee,
  PinVerification,
  SessionContext,
} from "./auth";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Table<Row> = {
  Row: { [Key in keyof Row]: Row[Key] };
  Insert: { [Key in keyof Row]?: Row[Key] };
  Update: { [Key in keyof Row]?: Row[Key] };
  Relationships: [];
};
interface Timestamps {
  created_at: string;
  updated_at: string;
}
export interface ProductRow extends Timestamps {
  description_html?: string;
  supplier_id?: string;
  visibility?: "store" | "store-and-website";
  tags?: string[];
  id: string;
  store_id: string;
  internal_code: string;
  name: string;
  category: string;
  variant: string;
  unit: string;
  default_location_id: string | null;
  brand: string;
  compatible_model: string;
  quality_grade: string;
  color_variant: string;
  selling_price: number;
  minimum_selling_price: number;
  aliases: string[];
  notes: string;
  low_stock_level: number;
  primary_image_url: string | null;
  state: "active" | "archived";
  created_by: string | null;
}
export interface LocationRow extends Timestamps {
  stock_condition?: 'Available'|'Damaged';
  id: string;
  store_id: string;
  internal_code: string;
  name: string;
  kind: "rack" | "shelf" | "box";
  parent_location_id: string | null;
  active: boolean;
  created_by: string | null;
}
export type MovementType =
  | "RECEIVE"
  | "SALE"
  | "RETURN"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "REPAIR_USE"
  | "OUT_FOR_TEST"
  | "TEST_RETURN"
  | "ADJUSTMENT"
  | "DAMAGED"
  | "USED_DEVICE_PURCHASE";
export interface StockMovementRow {
  id: string;
  store_id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  movement_type: MovementType;
  reference_type: string | null;
  reference_id: string | null;
  actor_profile_id: string;
  transfer_group_id: string | null;
  idempotency_key: string | null;
  notes: string;
  created_at: string;
}
export interface ShiftRow extends Timestamps {
  id: string;
  store_id: string;
  employee_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: "scheduled" | "open" | "closed" | "cancelled";
  opening_cash: number | null;
  expected_cash: number | null;
  counted_cash: number | null;
  cash_difference: number | null;
  closing_notes: string | null;
  created_by: string | null;
}
export interface AuditRow {
  id: string;
  store_id: string | null;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
}
export interface PosProductRow {
  damaged_quantity?: number;
  primary_image_url?: string | null;
  id: string;
  internal_code: string;
  name: string;
  category: ProductRow["category"];
  brand: string;
  compatible_model: string;
  quality_grade: string;
  color_variant: string;
  selling_price: number;
  minimum_selling_price: number;
  aliases: string[];
  low_stock_level: number;
  quantity: number;
  location: { rack: string | null; shelf: string; box: string } | null;
}
type Rpc<Args, Returns> = { Args: Args; Returns: Returns };
export interface Database {
  public: {
    Tables: import("./transaction-rows").TransactionTables & {
      stores: Table<
        {
          id: string;
          name: string;
          branch_name: string;
          status: string;
        } & Timestamps
      >;
      profiles: Table<Profile & Timestamps>;
      store_memberships: Table<{
        profile_id: string;
        store_id: string;
        active: boolean;
        created_at: string;
      }>;
      permissions: Table<{ id: number; key: string; description: string }>;
      employee_permissions: Table<{
        profile_id: string;
        store_id: string;
        permission_id: number;
        enabled: boolean;
        updated_by: string | null;
        updated_at: string;
      }>;
      products: Table<ProductRow>;
      product_financials: Table<{
        product_id: string;
        store_id: string;
        purchase_cost: number;
        updated_by: string | null;
        updated_at: string;
      }>;
      locations: Table<LocationRow>;
      stock_movements: Table<StockMovementRow>;
      shifts: Table<ShiftRow>;
      audit_logs: Table<AuditRow>;
      counter_terminals: Table<{
        id: string;
        auth_user_id: string;
        store_id: string;
        name: string;
        active: boolean;
        created_at: string;
      }>;
      catalog_values: Table<{
        store_id: string;
        kind: string;
        value: string;
        created_at: string;
      }>;
      suppliers: Table<
        {
          id: string;
          store_id: string;
          name: string;
          phone: string;
          whatsapp: string;
          address: string;
          notes: string;
        } & Timestamps
      >;
      stock_receipts: Table<
        {
          id: string;
          store_id: string;
          supplier_id: string;
          reference: string;
          received_date: string;
          status: "Draft" | "Received";
          actor_profile_id: string;
        } & Timestamps
      >;
      stock_receipt_lines: Table<{
        receipt_id: string;
        store_id: string;
        line_no: number;
        product_id: string;
        location_id: string;
        quantity: number;
      }>;
      stock_receipt_costs: Table<{
        receipt_id: string;
        store_id: string;
        line_no: number;
        purchase_cost: number;
      }>;
    };
    Views: {
      stock_balances: {
        Row: {
          store_id: string;
          product_id: string;
          location_id: string;
          quantity: number;
        };
        Relationships: [];
      };
    };
    Functions: import("./transactions").TransactionFunctions & {
      save_product: Rpc<{ p_store_id: string; p_input: Json }, ProductRow>;
      duplicate_product: Rpc<{ p_store_id: string; p_id: string }, ProductRow>;
      archive_product: Rpc<{ p_store_id: string; p_id: string }, undefined>;
      save_location: Rpc<{ p_store_id: string; p_input: Json }, LocationRow>;
      archive_location: Rpc<{ p_store_id: string; p_id: string }, undefined>;
      save_supplier: Rpc<
        { p_store_id: string; p_input: Json },
        Database["public"]["Tables"]["suppliers"]["Row"]
      >;
      save_stock_receipt: Rpc<
        { p_store_id: string; p_input: Json; p_receive: boolean },
        undefined
      >;
      transfer_stock: Rpc<
        {
          p_store_id: string;
          p_product_id: string;
          p_source: string;
          p_destination: string;
          p_quantity: number;
          p_request_id: string;
        },
        undefined
      >;
      adjust_stock: Rpc<
        {
          p_store_id: string;
          p_product_id: string;
          p_location_id: string;
          p_expected: number;
          p_new_quantity: number;
          p_reason: string;
          p_request_id: string;
        },
        undefined
      >;
      get_employees: Rpc<
        { p_store_id: string },
        (Profile & {
          permissions: import("./auth").PermissionKey[];
          updated_at: string;
        })[]
      >;
      save_employee: Rpc<{ p_store_id: string; p_input: Json }, undefined>;
      set_employee_permissions: Rpc<
        { p_store_id: string; p_profile_id: string; p_permissions: string[] },
        undefined
      >;
      provision_profile: Rpc<
        {
          p_auth_user_id: string;
          p_full_name: string;
          p_role: string;
          p_store_id: string;
        },
        undefined
      >;
      get_session_context: Rpc<Record<string, never>, SessionContext>;
      get_pos_products: Rpc<{ p_store_id: string }, PosProductRow[]>;
      get_product_financials: Rpc<
        { p_store_id: string },
        { product_id: string; purchase_cost: number }[]
      >;
      get_profit_summary: Rpc<
        { p_store_id: string },
        { available: boolean; gross_profit: number | null; reason: string }
      >;
      list_counter_employees: Rpc<Record<string, never>, CounterEmployee[]>;
      verify_counter_pin: Rpc<
        { p_profile_id: string; p_pin: string },
        PinVerification
      >;
      lock_counter_session: Rpc<Record<string, never>, undefined>;
      set_employee_pin: Rpc<
        { p_profile_id: string; p_store_id: string; p_pin: string },
        undefined
      >;
      set_employee_permission: Rpc<
        {
          p_profile_id: string;
          p_store_id: string;
          p_key: string;
          p_enabled: boolean;
        },
        undefined
      >;
      log_client_event: Rpc<{ p_action: string; p_version: string }, undefined>;
      update_my_profile: Rpc<
        { p_full_name: string; p_phone: string },
        undefined
      >;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
