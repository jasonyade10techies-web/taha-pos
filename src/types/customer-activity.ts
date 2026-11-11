export const activityCategories = [
  "All",
  "Sales",
  "Payments",
  "Returns",
  "Credit",
  "Test Items",
  "Notes",
] as const;
export type ActivityCategory = (typeof activityCategories)[number];
export interface ActivityFilter {
  category?: ActivityCategory;
  from?: string;
  to?: string;
  order?: "newest" | "oldest";
  offset?: number;
  limit?: number;
}
export interface CustomerActivity {
  id: string;
  type: string;
  title: string;
  category: Exclude<ActivityCategory, "All">;
  createdAt: string;
  employeeId: string;
  employeeName: string;
  reference: string;
  entityType: string;
  entityId: string;
  saleId?: string;
  description: string;
  amount?: number;
  balance?: number;
  quantity?: number;
  condition?: string;
}
export interface ActivityPage {
  rows: CustomerActivity[];
  total: number;
  outstanding?: number;
}
export interface CustomerNote {
  id: string;
  customerId: string;
  text: string;
  employeeId: string;
  employeeName: string;
  createdAt: string;
  idempotencyKey: string;
}

export interface CustomerActivityDetail {sale?:import('./demo').Sale;returned?:import('./demo').ReturnRecord;payment?:import('./demo').Payment;test?:import('./demo').TestOut;ledger?:import('./demo').Ledger;event?:CustomerActivity;}
