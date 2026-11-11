export interface ProductLocation {
  rack: string;
  shelf: string;
  box: string;
}

/** Admin domain model. Purchase cost comes from a separate permission-gated financial repository. */
export interface Product {
  id: string;
  internalCode: string;
  name: string;
  category: string;
  brand: string;
  compatibleModel: string;
  qualityGrade: string;
  color: string;
  quantity: number;
  sellingPrice: number;
  minimumSellingPrice: number;
  purchaseCost: number;
  location: ProductLocation | null;
  aliases: string[];
  notes: string;
  lowStockLevel: number;
}

/** Explicit employee DTO; cost is intentionally absent from the POS boundary. */
export interface PosProduct {
  damagedQuantity?: number;
  customService?: { name: string; description: string; sellingPrice: number; minimumSellingPrice: number; material?: ServiceMaterial };
  image?: string;
  id: string;
  internalCode: string;
  name: string;
  category: Product["category"];
  brand: string;
  compatibleModel: string;
  qualityGrade: string;
  color: string;
  quantity: number;
  sellingPrice: number;
  minimumSellingPrice: number;
  location: ProductLocation | null;
  aliases: string[];
  lowStockLevel: number;
}
export interface ServiceMaterial {
  pricing?: {sellingPrice:number;minimumSellingPrice:number;reviewedAt:string};
  productId: string;
  quantity: number;
  allocations: {locationId: string; quantity: number}[];
}

export interface CartItem {
  product: PosProduct;
  quantity: number;
  unitPrice: number;
  priceReason?: string;
  approval?: import("./demo").Approval;
}
export interface CustomerDisplayItem {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  unitPrice: number;
}
export interface CustomerDisplaySnapshot {
  items: CustomerDisplayItem[];
  subtotal: number;
  discount: number;
  total: number;
}
