export type StockCondition = "Available" | "Damaged";
export interface StockOverview {
  productId: string;
  available: number;
  damaged: number;
  outForTest: number;
  totalPhysical: number;
  reserved?: number;
}
export interface ConditionLocation {
  locationId: string;
  path: string;
  stockCondition: StockCondition;
}
export interface DamagedStockEntry {
  events?: {
    id: string;
    action: string;
    quantity: number;
    locationId: string;
    notes: string;
    employeeId: string;
    createdAt: string;
  }[];
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  locationId: string;
  locationPath: string;
  saleId?: string;
  returnId?: string;
  invoice?: string;
  customerId?: string;
  customerName?: string;
  employeeId: string;
  employeeName: string;
  reason: string;
  createdAt: string;
  disposition: string;
  photos?: string[];
  photoPaths?: string[];
  historical?: boolean;
  quantityUnknown?: boolean;
  returnedQuantity?: number;
}
export interface DamageAction {
  idempotencyKey: string;
  lotId: string;
  sourceLocationId: string;
  quantity: number;
  expectedQuantity: number;
  action: "transfer" | "recover" | "write-off" | "note";
  destinationId?: string;
  notes: string;
  photos?: string[];
}
export interface ConditionMovement {
  id: string;
  lotId: string;
  productId: string;
  locationId: string;
  quantity: number;
  action:
    | "RETURN_DAMAGED"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "RECOVER"
    | "WRITE_OFF"
    | "NOTE";
  employeeId: string;
  createdAt: string;
  notes: string;
  photos?: string[];
}
