import type { PosProduct } from "../../types/product";
import type {
  DemoProduct,
  ProductInput,
  Location,
  Balance,
  Movement,
  Sale,
  SaleInput,
  Customer,
  Ledger,
  TestOut,
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
  ReportSnapshot,
  ReturnRecord,
} from "../../types/demo";
export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
}
export interface EditableRepository<
  T extends { id: string },
> extends Repository<T> {
  save(value: T): Promise<T>;
}
export interface ProductRepository extends Repository<DemoProduct> {
  values(): Promise<{ kind: string; value: string }[]>;
  saveValue(kind: string, value: string): Promise<{ id: string; kind: string; value: string }>;
  pos(): Promise<PosProduct[]>;
  cost(id: string): Promise<number | null>;
  save(input: ProductInput): Promise<DemoProduct>;
  duplicate(id: string): Promise<DemoProduct>;
  archive(id: string): Promise<void>;
}
export interface LocationRepository extends EditableRepository<Location> {
  archive(id: string): Promise<void>;
  path(id: string): Promise<string>;
  balances(): Promise<Balance[]>;
}
export interface InventoryRepository {
  conditions?(productId?: string): Promise<import('../../types/inventory-conditions').StockOverview[]>;
  damaged?(productId?: string): Promise<import('../../types/inventory-conditions').DamagedStockEntry[]>;
  conditionLocations?(condition: import('../../types/inventory-conditions').StockCondition): Promise<import('../../types/inventory-conditions').ConditionLocation[]>;
  damageAction?(input: import('../../types/inventory-conditions').DamageAction): Promise<import('../../types/inventory-conditions').DamagedStockEntry[]>;
  adjust(
    productId: string,
    locationId: string,
    expected: number,
    quantity: number,
    reason: string,
  ): Promise<void>;
  balances(): Promise<Balance[]>;
  movements(): Promise<Movement[]>;
  drafts(): Promise<ReceiveDraft[]>;
  receive(draft: ReceiveDraft): Promise<void>;
  saveDraft(draft: ReceiveDraft): Promise<void>;
  transfer(
    productId: string,
    source: string,
    destination: string,
    quantity: number,
  ): Promise<void>;
}
export interface SalesRepository extends Repository<Sale> {
  lookup?(filter:import('../../types/transactions').SaleFilter):Promise<import('../../types/transactions').SalePage>;
  page?(filter: import("../../types/transactions").SaleFilter): Promise<import("../../types/transactions").SalePage>;
  complete(input: SaleInput): Promise<Sale>;
  void(id: string): Promise<void>;
  returnItem(
    saleId: string,
    productId: string,
    quantity: number,
    reason: string,
    destination: ReturnRecord["destination"],
    approval?: string,
    options?: import("../../types/transactions").ReturnOptions,
  ): Promise<ReturnRecord>;
  returns(saleId?:string): Promise<ReturnRecord[]>;
}
export interface CustomerRepository extends EditableRepository<Customer> {
  reminders?(customerId?:string):Promise<import('../../types/reminders').ReminderObligation[]>;
  reminderAlerts?():Promise<import('../../types/reminders').ReminderAlert[]>;
  recordReminder?(input:import('../../types/reminders').ReminderInput):Promise<import('../../types/reminders').ReminderHistory>;
  timeline?(customerId:string,filter?:import('../../types/customer-activity').ActivityFilter):Promise<import('../../types/customer-activity').ActivityPage>;
  activityDetail?(customerId:string,eventId:string):Promise<import('../../types/customer-activity').CustomerActivityDetail>;
  addNote?(customerId:string,input:{idempotencyKey:string;text:string}):Promise<import('../../types/customer-activity').CustomerActivity>;
  outstanding(id: string): Promise<number>;
}
export interface CreditRepository {
  ledger(customerId?: string): Promise<Ledger[]>;
  receive(
    customerId: string,
    amount: number,
    methodId: string,
    reference: string,
    notes: string,
    options?: import("../../types/transactions").CollectionOptions,
  ): Promise<string>;
  tests(): Promise<TestOut[]>;
  send(test: TestOut): Promise<TestOut>;
  returnTest(id: string, locationId?: string): Promise<void>;
  extendTest(id: string, date: string): Promise<void>;
}
export type EmployeeRepository = EditableRepository<DemoEmployee> & {
  setPermissions(
    id: string,
    permissions: import("../../types/auth").PermissionKey[],
  ): Promise<void>;
  updateOwnProfile(name: string, phone: string): Promise<void>;
};
export interface ShiftRepository extends EditableRepository<Shift> {
  closing(id: string): Promise<{
    cashSales: number;
    collections: number;
    purchases: number;
    expected: number;
    offlineCash?:{collected:number;posted:number;unposted:number;refunded:number;unresolvedCount:number};
    closingSnapshotPreserved?:boolean;
    lateSubmittedCount?:number;
  }>;
  close(
    id: string,
    counted: number,
    expenses: number,
    notes: string,
  ): Promise<void>;
}
export interface MaterialLocation {productId: string; locationId: string; quantity: number; path?: string}
export interface ServiceRepository extends EditableRepository<RepairService> {
  materialLocations?(productId: string): Promise<MaterialLocation[]>;
}
export interface DevicePurchaseRepository extends Repository<DevicePurchase> {
  purchase(value: DevicePurchase, locationId: string): Promise<DevicePurchase>;
  updateStatus(id: string, status: DevicePurchase["status"]): Promise<void>;
}
export interface PaymentRepository extends EditableRepository<PaymentMethod> {
  reverse?(id: string, reason: string): Promise<void>;
  entries(): Promise<import("../../types/demo").Payment[]>;
}
export interface CouponRepository extends EditableRepository<Coupon> {
  validate(
    code: string,
    lines: { product: PosProduct; quantity: number; unitPrice: number }[],
    customerId?: string,
  ): Promise<{ code: string; discount: number }>;
}
export interface ReportRepository {
  snapshot(from?: string, to?: string): Promise<ReportSnapshot>;
}
export interface WebsiteRepository {
  products(): Promise<WebsiteProduct[]>;
  saveProduct(value: WebsiteProduct): Promise<void>;
  enquiries: EditableRepository<Enquiry>;
  convert(id: string, technicianId: string): Promise<RepairJob>;
}
export interface Repositories {
  products: ProductRepository;
  locations: LocationRepository;
  inventory: InventoryRepository;
  sales: SalesRepository;
  customers: CustomerRepository;
  credit: CreditRepository;
  employees: EmployeeRepository;
  shifts: ShiftRepository;
  services: ServiceRepository;
  devices: DevicePurchaseRepository;
  payments: PaymentRepository;
  coupons: CouponRepository;
  reports: ReportRepository;
  website: WebsiteRepository;
  jobs: EditableRepository<RepairJob>;
  suppliers: EditableRepository<Supplier>;
  audit: Repository<AuditEvent>;
  settings: {
    get(): Promise<DemoSettings>;
    save(settings: DemoSettings): Promise<void>;
  };
  reset(): Promise<void>;
}
