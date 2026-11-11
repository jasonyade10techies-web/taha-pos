import { apiSales } from "../api/transaction-repositories";
import { nativeInfo } from "./runtime";
import { requireMobileOnline } from "./staff-service";
import { useSessionStore } from "../../stores/session-store";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import { createInvoicePdf } from "../invoice-pdf";
import type { Sale, SaleInput } from "../../types/demo";
import type { CartItem } from "../../types/product";
import { normalizeWhatsapp } from "../reminders";
import { apiStoreMedia } from "../api/media";
export interface MobileDraft {
  cartId: string;
  checkoutId: string;
  items: CartItem[];
  customerId: string;
  submitted?: SaleInput;
}
export const emptyMobileDraft = (): MobileDraft => ({
  cartId: crypto.randomUUID(),
  checkoutId: crypto.randomUUID(),
  items: [],
  customerId: "",
});
export const mobileDraftScope = () =>
  `${useShopConnectionStore.getState().baseUrl}:${useSessionStore.getState().context?.store?.id}:${useSessionStore.getState().profile?.id}`;
const key = (scope: string) => "taha-mobile-sale:" + scope;
export function loadMobileDraft(scope: string): MobileDraft {
  try {
    const value = JSON.parse(localStorage.getItem(key(scope)) || "null");
    if (
      typeof value?.cartId === "string" &&
      /^[0-9a-f-]{36}$/i.test(value.cartId) &&
      Array.isArray(value.items)
    )
      return value;
  } catch {
    /* Invalid drafts never replace shop data. */
  }
  return emptyMobileDraft();
}
export function saveMobileDraft(scope: string, draft: MobileDraft) {
  localStorage.setItem(key(scope), JSON.stringify(draft));
}
window.addEventListener("taha-session-clear", () => {
  for (const k of Object.keys(localStorage))
    if (k.startsWith("taha-mobile-sale:")) localStorage.removeItem(k);
});
export function mobileSalesDeviceId() {
  const native = nativeInfo().deviceId;
  if (native) return native;
  const key = "taha-mobile-sales-device";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
/** Uses the shared API transaction, proof upload, tax and authorization path. Never queues a financial write. */
export async function completeMobileSale(
  input: SaleInput,
  onPrepared?: (input: SaleInput) => void,
) {
  requireMobileOnline();
  if (!navigator.onLine)
    throw new Error(
      "Reconnect to the shop to complete this sale. Your mobile draft is saved.",
    );
  const payments = await Promise.all(
    input.payments.map(async (p) => ({
      ...p,
      proof: await apiStoreMedia(
        p.proof ?? "",
        "proof",
        "",
        input.idempotencyKey,
        undefined,
        p.methodId,
      ),
    })),
  );
  const prepared = { ...input, payments };
  // The backend hashes the request. Persist uploaded paths before sending, so retries after restart are identical.
  onPrepared?.(prepared);
  const payload = {
    ...prepared,
    clientChannel: "mobile",
    deviceId: mobileSalesDeviceId(),
  };
  return apiSales.complete(payload);
}
export async function shareMobileReceipt(sale: Sale) {
  const pdf = await createInvoicePdf(sale);
  if (window.TahaNative?.shareReceiptPdf) {
    const uri = pdf.output("datauristring");
    if (
      !window.TahaNative.shareReceiptPdf(
        JSON.stringify({
          filename: sale.invoice + ".pdf",
          base64: uri.slice(uri.indexOf(",") + 1),
        }),
      )
    )
      throw new Error("Could not prepare the receipt PDF for sharing.");
    return;
  }
  const file = new File([pdf.output("blob")], sale.invoice + ".pdf", {
    type: "application/pdf",
  });
  if (navigator.canShare?.({ files: [file] }))
    await navigator.share({ title: sale.invoice, files: [file] });
  else pdf.save(sale.invoice + ".pdf");
}
export function openMobileWhatsapp(phone: string, sale: Sale) {
  const number = normalizeWhatsapp(phone);
  if (!number)
    throw new Error("Enter a valid WhatsApp number, or copy the receipt link.");
  if (!sale.receiptUrl)
    throw new Error("This sale has no receipt link. Share its PDF instead.");
  const message =
    "Thank you for shopping at Taha Mobiles. Receipt " +
    sale.invoice +
    ": " +
    sale.receiptUrl;
  if (window.TahaNative?.openWhatsapp) {
    if (!window.TahaNative.openWhatsapp(JSON.stringify({ number, message })))
      throw new Error(
        "Could not open WhatsApp. Copy the receipt link instead.",
      );
  } else
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
}
