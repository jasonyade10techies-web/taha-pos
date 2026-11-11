import type { Json } from "./database";
import type { Sale, Payment, ReturnRecord } from "./demo";
import type { DashboardData } from "./dashboard";
export interface TransactionSummary {
  sales: number; transactions: number; returns: number; discounts: number;
  creditGiven: number; debtCollected: number; cash: number; digital: number;
}
export interface SaleFilter {
  id?:string;
  search?: string; employee?: string; customer?: string; method?: string;
  status?: string; from?: string; to?: string; page?: number; limit?: number;
}
export interface SalePage { rows: Sale[]; total: number; page: number; limit: number }
export interface TransactionReport {
  summary: TransactionSummary; profit: number | null; chart: DashboardData["chart"];
  methods: { id: string; name: string; total: number }[];
  top: { id: string; name: string; quantity: number; total: number }[];
  employees: { id: string; name: string; transactions: number; sales: number; average: number; collections: number; voids: number; full?: number; discounted?: number; averageDiscount?: number; overrides?: number; returns?: number; cashDifference?: number }[];
  credit: { id: string; name: string; balance: number }[]; recentSales: Sale[];
}
export interface DashboardTransactions {
  summary: TransactionSummary | null; profit: number | null;
  chart: DashboardData["chart"]; activity: DashboardData["activity"]; credit: DashboardData["credit"];
}
export interface ReturnOptions {
  expectedManualRefund?: number; expectedCreditReduction?: number;
    refundLabor?:boolean;
  locationId?: string; receiptConfirmed?: boolean; manualRefundConfirmed?: boolean;
  refundMethodId?: string; approvalToken?: string; idempotencyKey?: string;
}
export interface CollectionOptions {
  proof?: string; verified?: boolean; approvalToken?: string; cartId?: string; idempotencyKey?: string;
}
type Rpc<A,R> = { Args: A; Returns: R };
type Write<R> = Rpc<{p_store_id:string;p_input:Json},R>;
export type TransactionFunctions = {
  get_transaction_result: Rpc<{p_store_id:string;p_operation:string;p_request_id:string},Json>;
  device_data: Write<Json>;
  get_business_settings: Rpc<{p_store_id:string},Json>;
  save_business_settings: Write<undefined>; save_customer: Write<string>;
  save_payment_method: Write<string>; save_coupon: Write<string>;
  list_transaction_approvers: Rpc<{p_store_id:string;p_permission:string},{id:string;full_name:string}[]>;
  approve_transaction: Rpc<{p_store_id:string;p_manager_id:string;p_pin:string;p_purpose:string;p_payload:Json}, {ok:boolean;message?:string;token?:string;expiresAt?:string;managerId?:string;managerName?:string}>;
  complete_sale: Write<Sale>; receive_credit_payment: Write<Payment>;
  reverse_payment: Write<Payment>; return_sale_item: Write<ReturnRecord>; void_sale: Write<Sale>;
  save_test_out: Write<Json>; update_test_out: Write<Json>;
  quote_coupon: Rpc<{p_store_id:string;p_code:string;p_lines:Json;p_customer_id?:string|null},{code:string;discount:number}>;
  get_customer_balance: Rpc<{p_store_id:string;p_customer_id:string},number>;
  get_sale: Rpc<{p_store_id:string;p_id:string},Sale|null>;
  list_sales: Rpc<{p_store_id:string;p_filter?:Json},SalePage>;
  transaction_data: Rpc<{p_store_id:string;p_kind:string;p_filter?:Json},Json>;
  get_transaction_report: Rpc<{p_store_id:string;p_from:string;p_to:string},TransactionReport>;
  get_employee_report: Rpc<{p_store_id:string;p_from:string;p_to:string},{id:string;name:string;transactions:number;sales:number;average:number;full:number;discounted:number;averageDiscount:number;overrides:number;collections:number;returns:number;voids:number;cashDifference:number}[]>;
  get_dashboard_transactions: Rpc<{p_store_id:string},DashboardTransactions>;
}
