import type { PosProduct } from "../types/product";
export interface TaxProfile {
  id: string;
  name: string;
  rate: number;
  mode: "Exclusive" | "Inclusive";
  appliesTo: "Products" | "Services" | "Both";
  enabled: boolean;
}
export interface TaxSnapshot {
  profileId?: string;
  name: string;
  rate: number;
  mode: "Exclusive" | "Inclusive";
  appliesTo: "Products" | "Services" | "Both";
  taxable: number;
  amount: number;
  net: number;
  total: number;
}
export function quoteTax(
  items: {
    product: Pick<PosProduct, "category"> &
      Partial<Pick<PosProduct, "id" | "minimumSellingPrice">>;
    unitPrice: number;
    quantity: number;
  }[],
  discount: number,
  profiles: TaxProfile[] = [],
  defaultId?: string,
  coupon?: { eligible: string; targets: string[] },
): TaxSnapshot {
  const round = (value: number) =>
      Math.round((value + Number.EPSILON) * 100) / 100,
    base = round(
      items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    ),
    net = round(Math.max(0, base - discount)),
    profile = profiles.find((item) => item.id === defaultId && item.enabled);
  if (!profile)
    return {
      name: "Tax",
      rate: 0,
      mode: "Exclusive",
      appliesTo: "Both",
      taxable: 0,
      amount: 0,
      net,
      total: net,
    };
  let remaining = discount;
  const amounts = items.map((item) => {
    const gross = item.unitPrice * item.quantity,
      eligible =
        !coupon ||
        coupon.eligible === "All" ||
        (coupon.eligible === "Services" &&
          item.product.category === "Services") ||
        (coupon.eligible === "Products" &&
          coupon.targets.includes(item.product.id ?? "")) ||
        (coupon.eligible === "Categories" &&
          coupon.targets.includes(item.product.category));
    const deduction =
      coupon && eligible
        ? Math.min(
            remaining,
            Math.max(
              0,
              item.unitPrice - (item.product.minimumSellingPrice ?? 0),
            ) * item.quantity,
          )
        : 0;
    remaining = round(remaining - deduction);
    return {
      item,
      net: coupon ? round(gross - deduction) : base ? (gross * net) / base : 0,
    };
  });
  const taxable = round(
      amounts
        .filter(
          ({ item }) =>
            profile.appliesTo === "Both" ||
            (item.product.category === "Services") ===
              (profile.appliesTo === "Services"),
        )
        .reduce((sum, item) => sum + item.net, 0),
    ),
    amount = round(
      profile.mode === "Inclusive"
        ? taxable - taxable / (1 + profile.rate / 100)
        : (taxable * profile.rate) / 100,
    );
  return {
    profileId: profile.id,
    name: profile.name,
    rate: profile.rate,
    mode: profile.mode,
    appliesTo: profile.appliesTo,
    taxable,
    amount,
    net: profile.mode === "Inclusive" ? round(net - amount) : net,
    total: profile.mode === "Exclusive" ? round(net + amount) : net,
  };
}
