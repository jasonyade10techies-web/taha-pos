import Dexie, { type Table } from "dexie";
import type {
  DemoProduct,
  Financial,
  Location,
  Balance,
  Movement,
  Sale,
  Payment,
  Customer,
  Ledger,
  TestOut,
  ReturnRecord,
  RepairService,
  RepairJob,
  DevicePurchase,
  Supplier,
  DemoEmployee,
  Shift,
  Coupon,
  PaymentMethod,
  Enquiry,
  WebsiteProduct,
  AuditEvent,
  ReceiveDraft,
  DemoSettings,
} from "../../types/demo";

class DemoDatabase extends Dexie {
  catalogValues!: Table<{id:string;kind:string;value:string;normalized:string},string>;
  reminderHistory!:Table<import('../../types/reminders').ReminderHistory,string>;
  customerNotes!:Table<import('../../types/customer-activity').CustomerNote,string>;
  damagedLots!: Table<import('../../types/inventory-conditions').DamagedStockEntry,string>;
  conditionMovements!: Table<import('../../types/inventory-conditions').ConditionMovement,string>;
  stockRequests!: Table<{id:string;payload:string;kind:'return'|'damage';result:unknown},string>;
  products!: Table<DemoProduct, string>;
  financials!: Table<Financial, string>;
  locations!: Table<Location, string>;
  balances!: Table<Balance, string>;
  movements!: Table<Movement, string>;
  sales!: Table<Sale, string>;
  saleCosts!: Table<
    { id: string; cost: number; byProduct?: Record<string, number>; unknownMaterialCost?: boolean },
    string
  >;
  payments!: Table<Payment, string>;
  customers!: Table<Customer, string>;
  ledger!: Table<Ledger, string>;
  testOuts!: Table<TestOut, string>;
  returns!: Table<ReturnRecord, string>;
  services!: Table<RepairService, string>;
  jobs!: Table<RepairJob, string>;
  devices!: Table<DevicePurchase, string>;
  suppliers!: Table<Supplier, string>;
  employees!: Table<DemoEmployee, string>;
  shifts!: Table<Shift, string>;
  coupons!: Table<Coupon, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  enquiries!: Table<Enquiry, string>;
  website!: Table<WebsiteProduct, string>;
  audit!: Table<AuditEvent, string>;
  drafts!: Table<ReceiveDraft, string>;
  settings!: Table<DemoSettings, string>;
  meta!: Table<{ id: string; value: number }, string>;
  constructor() {
    super("taha-pos-local-prototype");
    this.version(1).stores({
      products: "id,&internalCode,name,category,brand,state",
      financials: "id",
      locations: "id,&code,parentId,kind",
      balances: "id,[productId+locationId],productId,locationId",
      movements: "id,productId,locationId,type,createdAt,reference",
      sales: "id,&invoice,customerId,employeeId,createdAt,status",
      saleCosts: "id",
      payments: "id,&code,saleId,customerId,createdAt,employeeId",
      customers: "id,name,type",
      ledger: "id,customerId,createdAt,reference",
      testOuts: "id,&code,productId,customerId,status",
      returns: "id,saleId,createdAt",
      services: "id,name",
      jobs: "id,&code,status,technicianId",
      devices: "id,&code,productId,imei1,status",
      suppliers: "id,name",
      employees: "id,role,status",
      shifts: "id,employeeId,date,status",
      coupons: "id,&code",
      paymentMethods: "id,kind",
      enquiries: "id,status",
      website: "id",
      audit: "id,employeeId,module,action,createdAt",
      drafts: "id,status",
      settings: "id",
      meta: "id",
    });
    this.version(2).stores({
      damagedLots:'id,productId,returnId,saleId',
      conditionMovements:'id,lotId,productId,locationId,createdAt',
      stockRequests:'id,kind',
    });
    this.version(3).stores({customerNotes:'id,customerId,&idempotencyKey,createdAt'});
    this.version(4).stores({reminderHistory:'id,customerId,obligationId,&idempotencyKey,createdAt'});
    this.version(5).stores({catalogValues:'id,&[kind+normalized],kind'});
  }
}
export const demoDb = new DemoDatabase();
export const money = (value: number) => Math.round(value * 100) / 100;
export function requireValue(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
export const newId = () => crypto.randomUUID();
export async function nextCode(prefix: string) {
  const row = await demoDb.meta.get(prefix);
  const value = (row?.value ?? 0) + 1;
  await demoDb.meta.put({ id: prefix, value });
  return `${prefix}${String(value).padStart(6, "0")}`;
}
export async function atomic<T>(operation: () => Promise<T>): Promise<T> {
  const result = await demoDb.transaction("rw", demoDb.tables, operation);
  window.dispatchEvent(new Event("taha-demo-changed"));
  return result;
}
