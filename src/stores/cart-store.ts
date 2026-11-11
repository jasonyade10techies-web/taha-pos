import { create } from "zustand";
import type { CartItem, PosProduct, ServiceMaterial } from "../types/product";
import type { Approval } from "../types/demo";
import { useSessionStore } from "./session-store";
import { permitted } from "../features/auth/services/permission-service";
interface CartState {
  cartId: string;
  checkoutId: string;
  items: CartItem[];
  allowNegativeStock: boolean;
  setStockPolicy: (allow: boolean) => void;
  coupon: boolean;
  couponCode: string;
  couponDiscount: number;
  customerId: string;
  sourceTestId?: string;
  add: (product: PosProduct) => void;
  changeQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  reviewServiceMaterial: (id:string,material:ServiceMaterial)=>void;
  updatePrice: (
    id: string,
    price: number,
    reason: string,
    approval?: Approval,
  ) => void;
  setCoupon: (coupon: boolean, code?: string, discount?: number) => void;
  clear: () => void;
}
const couponReset = { coupon: false, couponCode: "", couponDiscount: 0 };
export const useCartStore = create<CartState>((set) => ({
  cartId: crypto.randomUUID(),
  checkoutId: crypto.randomUUID(),
  items: [],
  allowNegativeStock: false,
  setStockPolicy: (allowNegativeStock) => set({ allowNegativeStock }),
  ...couponReset,
  customerId: "",
  sourceTestId: undefined,
  add: (product) =>
    set((s) => {
      const existing = s.items.find((i) => i.product.id === product.id);
      if (
        product.category !== "Services" &&
        !s.allowNegativeStock &&
        product.quantity <= (existing?.quantity ?? 0)
      )
        return s;
      return {
        ...couponReset,
        items: existing
          ? s.items.map((i) =>
              i.product.id === product.id
                ? { ...i, quantity: i.quantity + 1 }
                : i,
            )
          : [
              ...s.items,
              { product, quantity: 1, unitPrice: product.sellingPrice },
            ],
      };
    }),
  changeQuantity: (id, quantity) =>
    set((s) => ({
      ...couponReset,
      items: s.items.map((i) =>
        i.product.id === id
          ? {
              ...i,
              quantity: Math.min(
                s.allowNegativeStock || i.product.category === "Services"
                  ? 999999
                  : i.product.quantity,
                Math.max(1, Math.floor(quantity)),
              ),
            }
          : i,
      ),
    })),
  remove: (id) =>
    set((s) => ({
      ...couponReset,
      items: s.items.filter((i) => i.product.id !== id),
    })),
  reviewServiceMaterial:(id,material)=>set(s=>({...couponReset,items:s.items.map(i=>i.product.id===id&&i.product.customService?{...i,approval:undefined,product:{...i.product,customService:{...i.product.customService,material}}}:i)})),
  updatePrice: (id, price, reason, approval) => {
    const session = useSessionStore.getState();
    set((s) => ({
      ...couponReset,
      items: s.items.map((i) =>
        i.product.id === id &&
        Number.isFinite(price) &&
        price > 0 &&
        (i.product.customService
          ? permitted(session.profile, session.permissions, "services.create_custom")
          : permitted(session.profile, session.permissions, "pricing.discount_within_range") && price <= i.product.sellingPrice)
          ? i.product.customService ? {
              ...i,
              unitPrice: Math.round(price * 100) / 100,
              product: { ...i.product, sellingPrice: Math.round(price * 100) / 100, minimumSellingPrice: 0,
                customService: { ...i.product.customService, sellingPrice: Math.round(price * 100) / 100, minimumSellingPrice: 0 } },
              priceReason: reason,
              approval,
            } : {
              ...i,
              unitPrice: Math.round(price * 100) / 100,
              priceReason: reason,
              approval,
            }
          : i,
      ),
    }));
  },
  setCoupon: (coupon, code = "", discount = 0) =>
    set(
      coupon
        ? { coupon, couponCode: code, couponDiscount: discount }
        : couponReset,
    ),
  clear: () =>
    set({ items: [], ...couponReset, customerId: "", sourceTestId: undefined, cartId:crypto.randomUUID(),checkoutId:crypto.randomUUID() }),
}));
