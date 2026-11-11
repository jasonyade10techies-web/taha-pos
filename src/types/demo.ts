import type { PosProduct } from "./product";
import type { PermissionKey, Profile } from "./auth";
export interface MediaImage { url: string; path?: string; id?: string; originalUrl?:string; crop?:import('../lib/image-edits').Crop }
export interface DemoProduct extends Omit<PosProduct, "quantity" | "location"> {
  description?: string;
  supplierId?: string;
  visibility?: "store" | "store-and-website";
  tags?: string[];
  gallery?: MediaImage[];
  updatedAt?: string;
  imagePath?: string;
  state: "active" | "archived";
  locationId: string;
  variant: string;
  unit: string;
  notes: string;
  image: string;
  createdAt: string;
}
export interface ProductInput extends Omit<
  DemoProduct,
  "id" | "internalCode" | "createdAt"
> {
  id?: string;
  draftRequestId?: string;
  purchaseCost?: number;
  initialQuantity: number;
  initialCondition?: "Available" | "Damaged";
}
export interface Location {
  stockCondition?: import('./inventory-conditions').StockCondition;
  updatedAt?: string;
  id: string;
  code: string;
  name: string;
  kind: "rack" | "shelf" | "box";
  parentId: string;
  archived: boolean;
}
export interface Balance {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
}
export interface Movement {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  type:
    | "RECEIVE"
    | "SALE"
    | "RETURN"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "OUT_FOR_TEST"
    | "TEST_RETURN"
    | "USED_DEVICE_PURCHASE"
    | "DAMAGED"
    | "ADJUSTMENT"
    | "REPAIR_USE";
  reference: string;
  employeeId: string;
  notes: string;
  createdAt: string;
}
export interface Financial {
  id: string;
  cost: number;
}
export interface Approval {
  token?: string;
  expiresAt?: string;
  managerId: string;
  managerName: string;
  reason: string;
  original: number;
  price: number;
  employeeId: string;
  createdAt: string;
}
export interface SaleLine {
  compound?: {productSellingBasis:number;productMinimumBasis?:number;productRevenue:number;laborRevenue:number;productDiscount:number;productTax:number;laborTax:number;productTotal:number;laborTotal:number};
  material?: import('./product').ServiceMaterial & {name: string; variant?: string; quantityPerService: number};
  taxAmount?: number;
  productId: string;
  name: string;
  variant: string;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  minimumPrice?: number;
  discount: number;
  total: number;
  locationId: string;
  service: boolean;
  stockAllocations?: { locationId: string; quantity: number }[];
  approval?: Approval;
  reason?: string;
}
export interface Sale {
  creditDueAt?:string;
  offlineId?:string;
  syncStatus?:'PENDING_SYNC'|'SYNCED'|'CONFLICT'|'REFUNDED';
  tax?: import("../lib/tax").TaxSnapshot;
  receiptUrl?: string;
  paid?: number;
  outstanding?: number;
  couponDiscount?: number;
  cashReceived?: number;
  change?: number;
  receipt?: { storeName: string; branch: string; phone: string; address: string; footer: string; showCashier?: boolean; showZeroTax?: boolean };
  id: string;
  invoice: string;
  customerId: string;
  customerName: string;
  employeeId: string;
  employeeName: string;
  createdAt: string;
  lines: SaleLine[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: string;
  status: "Paid" | "Partial" | "Credit" | "Voided" | "Returned";
  payments: PaymentAllocation[];
  returned: Record<string, number>;
  sourceTestId?: string;
}
export interface PaymentAllocation {
  id?: string;
  methodName?: string;
  methodKind?: string;
  status?: "Pending" | "Confirmed" | "Rejected" | "Reversed";
  kind?: Payment["kind"];
  approvalToken?: string;
  methodId: string;
  amount: number;
  reference: string;
  proof?: string;
  verified?: boolean;
}
export interface SaleInput {
  creditDueAt?:string;
  cartId?: string;
  creditOverrideReason?: string;
  lines: {
    customService?: import("./product").PosProduct["customService"];
    productId: string;
    quantity: number;
    unitPrice: number;
    reason?: string;
    approval?: Approval;
  }[];
  customerId: string;
  coupon: string;
  payments: PaymentAllocation[];
  cashReceived: number;
  sourceTestId?: string;
  idempotencyKey: string;
}
export interface Payment {
  status?: "Pending" | "Confirmed" | "Rejected" | "Reversed";
  methodName?: string;
  id: string;
  code: string;
  saleId: string;
  customerId: string;
  methodId: string;
  amount: number;
  kind: "sale" | "collection" | "refund" | "reversal";
  reference: string;
  notes: string;
  employeeId: string;
  createdAt: string;
  proof?: string;
}
export interface Customer {
  whatsappNumber?:string;
  whatsappSameAsPhone?:boolean;
  dueAt?:string;
  reminderEnabled?:boolean;
  tags?: string[];
  status?: "active" | "inactive";
  photoPath?: string;
  creditEnabled?: boolean;
  enforceCreditLimit?: boolean;
  outstanding?: number;
  id: string;
  name: string;
  type: "Individual" | "Shop / Business";
  shopName: string;
  ownerName: string;
  collectingPerson: string;
  phone: string;
  address: string;
  notes: string;
  photo: string;
  creditLimit: number | null;
  createdAt: string;
}
export interface Ledger {
  kind?: "charge" | "payment" | "return" | "reversal" | "adjustment";
  balance?: number;
  saleId?:string;
  paymentId?:string;
  id: string;
  customerId: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  employeeId: string;
  createdAt: string;
}
export interface TestOut {
  id: string;
  code: string;
  customerId: string;
  productId: string;
  locationId: string;
  quantity: number;
  takenDate: string;
  dueDate: string;
  employeeId: string;
  notes: string;
  status: "OUT" | "RETURNED" | "CONVERTED TO SALE";
  saleId?: string;
}
export interface ReturnRecord {
  refundLabor?:boolean;
  taxAmount?:number;
  condition?: 'Available'|'Damaged'|'Not restored';
  material?: {productId:string;quantity:number};
  locationId?: string;
  creditReduction?: number;
  manualRefund?: number;
  id: string;
  code: string;
  saleId: string;
  productId: string;
  quantity: number;
  reason: string;
  destination: "Sellable Stock" | "Damaged" | "Do Not Restore Stock";
  amount: number;
  employeeId: string;
  createdAt: string;
}
export interface RepairService {
  linkedProductId?:string|null;
  defaultLaborCharge?:number;
  pricingRule?:'current-product-plus-labor';
  description?:string;
  createdBy?:string;
  updatedBy?:string;
  requiresReview?:boolean;
  id: string;
  code: string;
  name: string;
  category: string;
  sellingPrice: number;
  minimumSellingPrice: number;
  active: boolean;
  notes: string;
}
export interface RepairJob {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  phone: string;
  device: string;
  imei: string;
  problem: string;
  damage: string;
  photos: string[];
  photoPaths?: string[];
  photoCategories?: string[];
  estimate: number;
  advance: number;
  technicianId: string;
  notes: string;
  status:
    | "Received"
    | "Diagnosing"
    | "Waiting Approval"
    | "Waiting Part"
    | "In Repair"
    | "Testing"
    | "Ready"
    | "Delivered"
    | "Cancelled";
  createdAt: string;
}
export interface DevicePurchase {
  id: string;
  code: string;
  productId: string;
  seller: string;
  phone: string;
  cnic: string;
  address: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  imei1: string;
  imei2: string;
  serial: string;
  pta: string;
  battery: number;
  condition: string;
  accessories: string;
  photos: string[];
  photoPaths?: string[];
  purchasePrice: number;
  targetPrice: number;
  minimumPrice: number;
  status: "In Stock" | "Sold" | "Repair Needed" | "Reserved";
  createdAt: string;
  employeeId?: string;
}
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  notes: string;
}
export interface DemoEmployee extends Profile {
  permissions: PermissionKey[];
  shift: string;
  lastActivity: string;
}
export interface Shift {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  status: "Scheduled" | "Open" | "Closed";
  openingCash: number;
  countedCash: number | null;
  cashExpenses: number;
  expectedCash: number | null;
  difference: number | null;
  notes: string;
  closedAt?: string;
}
export interface Coupon {
  id: string;
  code: string;
  type: "Percentage" | "Fixed";
  value: number;
  start: string;
  end: string;
  minimum: number;
  maxUses: number;
  uses: number;
  perCustomerLimit: number;
  eligible: "All" | "Products" | "Categories" | "Services";
  targets: string[];
  active: boolean;
}
export interface PaymentMethod {
  qrPath?: string;
  subtype?: "Cash" | "JazzCash" | "Easypaisa" | "Bank" | "Card" | "Other";
  requiresProof?: boolean;
  sortOrder?: number;
  id: string;
  name: string;
  kind: "Cash" | "Digital" | "Credit";
  title: string;
  number: string;
  iban: string;
  qr: string;
  enabled: boolean;
}
export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  device: string;
  problem: string;
  images: number;
  status: "New" | "Contacted" | "Quoted" | "Converted" | "Closed";
  quote: number;
  notes: string;
  createdAt: string;
  jobId?: string;
}
export interface WebsiteProduct {
  id: string;
  visible: boolean;
  availability: boolean;
  price: number;
  featured: boolean;
}
export interface AuditEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  action: string;
  module: string;
  description: string;
  reference: string;
  createdAt: string;
}
export interface ReceiveLine {
  productId: string;
  quantity: number;
  cost?: number;
  condition?: "Available" | "Damaged";
  locationId: string;
}
export interface ReceiveDraft {
  id: string;
  supplierId: string;
  reference: string;
  date: string;
  lines: ReceiveLine[];
  status: "Draft" | "Received";
  createdAt: string;
}
export interface DemoSettings {
  shopConfiguration?: import("./shop-configuration").ShopConfiguration;
  creditDueRequired?:boolean;
  remindersEnabled?:boolean;
  reminderWarningDays?:number;
  requirePaymentReference?: boolean;
  taxProfiles?: import("../lib/tax").TaxProfile[];
  defaultTaxProfileId?: string;
  showZeroTax?: boolean;
  searchDictionary?: import("../lib/product-search").SearchTerm[];
  appearance?: import("../lib/appearance").Appearance;
  phone?: string;
  address?: string;
  id: string;
  storeName: string;
  branch: string;
  currency: string;
  timezone: string;
  receiptPrinting: "Always Print" | "Ask After Checkout" | "Never Auto Print";
  customerDisplay: boolean;
  requireProof: boolean;
  bargaining: boolean;
  belowMinimum: "Manager Approval" | "Block" | "Allow with Reason";
  lowStockAlerts: boolean;
  negativeStock: boolean;
  defaultUnit: string;
  receiptRequired: boolean;
  returnDays: number;
  returnApproval: boolean;
  restoreReturns: boolean;
  notifications: boolean;
  receiptFooter: string;
  creditEnabled: boolean;
  customerDisplayFullscreen?: boolean;
  customerDisplayIdleTimeout?: number;
  customerDisplayPromotions?: boolean;
  customerDisplayPaymentQr?: boolean;
  mobileCameraEnabled?: boolean;
  mobileCameraRequireProof?: boolean;
  mobileCameraCompressImages?: boolean;
  mobileCameraImageQuality?: number;
  keyboardEnabled?: boolean;
  keyboardOpenOnTouch?: boolean;
  keyboardSize?: "Compact" | "Large";
  keyboardNumericAmounts?: boolean;
  defaultSaleCustomer?: string;
  showRecentCustomers?: boolean;
  allowQuickAddCustomer?: boolean;
  requirePhoneForCredit?: boolean;
}
export interface ReportSnapshot {
  unknownCostSales?: string[];
  aggregate?: import("./transactions").TransactionReport;
  sales: Sale[];
  payments: Payment[];
  returns: ReturnRecord[];
  ledger: Ledger[];
  products: PosProduct[];
  customers: Customer[];
  employees: DemoEmployee[];
  shifts: Shift[];
  profit: number | null;
  costBySale: Record<string, number>;
  restoredCostByReturn?: Record<string, number>;
}
