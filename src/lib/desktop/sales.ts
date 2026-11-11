import { invoke } from "@tauri-apps/api/core";
import type {
  Sale,
  SaleInput,
  DemoSettings,
  PaymentMethod,
} from "../../types/demo";
import type { PosProductRow } from "../../types/database";
import { useSessionStore } from "../../stores/session-store";
import { desktopScope, sqliteCache, sqliteReceipts } from "./database";
import { posModel } from "../supabase/mappers";
import { quoteTax } from "../tax";
export const offlineInvoice = (id: string) => `TM-INV-O-${id.toUpperCase()}`;
export async function completeDesktopCash(input: SaleInput) {
  const session = useSessionStore.getState(),
    [rows, settings, methods] = await Promise.all([
      sqliteCache<PosProductRow[]>("pos-products"),
      sqliteCache<DemoSettings>("settings"),
      sqliteCache<PaymentMethod[]>("payment-methods"),
    ]);
  if (!rows || !settings || !methods)
    throw new Error(
      "Open New Sale while connected once to prepare the offline catalogue and receipt settings.",
    );
  const old = (await sqliteReceipts()).find(
    (s) =>
      s.id === input.idempotencyKey || s.offlineId === input.idempotencyKey,
  );
  if (old) return old;
  const method = methods.find(
    (m) =>
      m.id === input.payments[0]?.methodId && m.kind === "Cash" && m.enabled,
  );
  if (
    !method ||
    input.payments.length !== 1 ||
    input.coupon ||
    input.sourceTestId
  )
    throw new Error(
      "Offline checkout supports cash catalogue sales. Credit, coupons, test conversions and electronic payments require a connection.",
    );
  const products = rows.map((p) => posModel(p)),
    items = input.lines.map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product || line.customService || line.approval)
        throw new Error(
          "Custom services and manager approvals require a connection.",
        );
      if (
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        !Number.isFinite(line.unitPrice) ||
        line.unitPrice < product.minimumSellingPrice ||
        line.unitPrice > product.sellingPrice
      )
        throw new Error(
          "Use the cached selling price or a permitted price above the minimum.",
        );
      if (
        line.unitPrice < product.sellingPrice &&
        ((session.profile?.role !== "owner" &&
          !session.permissions.includes("pricing.discount_within_range")) ||
          !line.reason?.trim())
      )
        throw new Error("A price discount needs permission and a reason.");
      return { ...line, product };
    });
  const tax = quoteTax(
      items,
      0,
      settings.taxProfiles,
      settings.defaultTaxProfileId,
    ),
    total = tax.total,
    paid = input.payments[0].amount;
  if (
    Math.round(paid * 100) !== Math.round(total * 100) ||
    input.cashReceived < paid
  )
    throw new Error("Cash must cover the sale total.");
  const subtotal = items.reduce(
      (v, i) => v + i.product.sellingPrice * i.quantity,
      0,
    ),
    discount = items.reduce(
      (v, i) => v + (i.product.sellingPrice - i.unitPrice) * i.quantity,
      0,
    ),
    invoice = offlineInvoice(input.idempotencyKey);
  const sale: Sale = {
    id: input.idempotencyKey,
    offlineId: input.idempotencyKey,
    invoice,
    customerId: input.customerId,
    customerName: "Walk-in Customer",
    employeeId: session.profile!.id,
    employeeName: session.profile!.full_name,
    createdAt: new Date().toISOString(),
    lines: items.map((i) => ({
      productId: i.product.id,
      name: i.product.name,
      variant: [i.product.qualityGrade, i.product.color]
        .filter(Boolean)
        .join(" · "),
      quantity: i.quantity,
      originalPrice: i.product.sellingPrice,
      unitPrice: i.unitPrice,
      minimumPrice: i.product.minimumSellingPrice,
      discount: (i.product.sellingPrice - i.unitPrice) * i.quantity,
      total: i.unitPrice * i.quantity,
      locationId: "",
      service: i.product.category === "Services",
      reason: i.reason,
    })),
    subtotal,
    discount,
    total,
    tax,
    coupon: "",
    couponDiscount: 0,
    status: "Paid",
    payments: input.payments.map((p) => ({
      ...p,
      methodKind: "Cash",
      methodName: method.name,
      status: "Confirmed",
    })),
    returned: {},
    cashReceived: input.cashReceived,
    change: input.cashReceived - paid,
    paid,
    outstanding: 0,
    syncStatus: "PENDING_SYNC",
    receipt: {
      storeName: settings.storeName,
      branch: settings.branch,
      phone: settings.phone || "",
      address: settings.address || "",
      footer: settings.receiptFooter,
    },
  };
  if (input.customerId) {
    const customers =
      await sqliteCache<{ id: string; name: string }[]>("customers");
    const customer = customers?.find((c) => c.id === input.customerId);
    if (!customer)
      throw new Error("Reconnect to verify this customer before checkout.");
    sale.customerName = customer.name;
  }
  const result = await invoke<Sale>("desktop_queue_sale", {
    scope: desktopScope(),
    receipt: sale,
    payload: {
      input,
      invoice,
      total,
      tax: { rate: tax.rate, mode: tax.mode, appliesTo: tax.appliesTo },
      catalog: items.map((i) => ({
        id: i.product.id,
        price: i.product.sellingPrice,
        minimum: i.product.minimumSellingPrice,
      })),
    },
  });
  window.dispatchEvent(new Event("taha-sync-retry"));
  window.dispatchEvent(new Event("taha-remote-changed"));
  return result;
}
