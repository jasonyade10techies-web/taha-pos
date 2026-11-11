import type { CartItem, CustomerDisplaySnapshot } from "../types/product";

export function cartTotals(items: CartItem[], coupon: boolean | number) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const listedTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.product.sellingPrice,
    0,
  );
  // Coupon cannot push a line below its minimum selling price.
  const room = items.reduce(
    (sum, item) =>
      sum +
      item.quantity *
        Math.max(0, item.unitPrice - item.product.minimumSellingPrice),
    0,
  );
  const couponDiscount = Math.min(
    typeof coupon === "number" ? coupon : coupon ? 500 : 0,
    room,
  );
  return {
    subtotal,
    negotiatedDiscount: listedTotal - subtotal,
    couponDiscount,
    total: subtotal - couponDiscount,
  };
}
export function customerSnapshot(
  items: CartItem[],
  coupon: boolean | number,
): CustomerDisplaySnapshot {
  const totals = cartTotals(items, coupon);
  return {
    items: items.map(({ product, quantity, unitPrice }) => ({
      id: product.id,
      name: product.name,
      variant: [product.qualityGrade, product.color]
        .filter(Boolean)
        .join(" · "),
      quantity,
      unitPrice,
    })),
    subtotal: totals.subtotal,
    discount: totals.couponDiscount,
    total: totals.total,
  };
}
