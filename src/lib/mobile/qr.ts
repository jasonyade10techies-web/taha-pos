import { parseShopAddress } from "./address";
export type TahaQr =
  | {
      type: "pairing";
      shop: string;
      terminal: string;
      code: string;
      expiresAt?: string;
    }
  | {
      type: "camera";
      shop: string;
      terminal: string;
      storeId: string;
      requestId: string;
      token: string;
    }
  | { type: "receipt"; reference: string }
  | { type: "location"; code: string }
  | { type: "product"; code: string };
/** Closed router: QR text is never an arbitrary navigation destination. */
export function parseTahaQr(value: string, testBuild: boolean, trustedShop?:string): TahaQr {
  if (/^TM-INV-[A-Z0-9-]{1,40}$/.test(value))
    return { type: "receipt", reference: value };
  if (/^TM-L-[0-9]{6,12}$/i.test(value))
    return { type: "location", code: value };
  if (/^TM-P-[0-9]{6,12}$/i.test(value))
    return { type: "product", code: value };
  if (value.length > 2048)
    throw new Error("This QR code is not recognized by Taha Mobiles.");
  try {
    const url = new URL(value);
    if(/^https?:$/.test(url.protocol)&&url.origin===trustedShop&&/^\/api\/v1\/receipts\/[A-Za-z0-9_.-]+$/.test(url.pathname)){const payload=url.pathname.split('/').at(-1)!.split('.')[1];const claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));if(claims.aud!=='taha-customer-receipt'||!/^TM-INV-[A-Z0-9-]{1,40}$/.test(claims.reference))throw new Error();return {type:'receipt',reference:claims.reference};}
    if (
      url.protocol !== "taha-mobile:" ||
      !["pair", "camera", "receipt", "location", "product"].includes(
        url.hostname,
      )
    )
      throw new Error();
    if (url.hostname === "product" || url.hostname === "location") {
      const code =
        url.searchParams.get("code") || url.searchParams.get("id") || "";
      if (!/^(TM-[PL]-[0-9]{6,12}|[a-f0-9-]{36})$/i.test(code))
        throw new Error();
      return { type: url.hostname, code };
    }
    if (url.hostname === "receipt") {
      const reference = url.searchParams.get("reference") || "";
      if (!/^TM-INV-[A-Z0-9-]{1,40}$/.test(reference)) throw new Error();
      return { type: "receipt", reference };
    }
    const shop = parseShopAddress(
        url.searchParams.get("shop") || "",
        testBuild,
      ).baseUrl,
      terminal = url.searchParams.get("terminal") || "";
    if (!terminal || terminal.length > 100) throw new Error();
    if (url.hostname === "pair") {
      const code = url.searchParams.get("code") || "",
        expiresAt = url.searchParams.get("expires") || undefined;
      if (
        !/^(\d{6}|[A-F0-9]{8})$/i.test(code) ||
        (expiresAt && !Number.isFinite(Date.parse(expiresAt)))
      )
        throw new Error();
      return {
        type: "pairing",
        shop,
        terminal,
        code: code.toUpperCase(),
        expiresAt,
      };
    }
    const storeId = url.searchParams.get("store") || "",
      requestId = url.searchParams.get("request") || "",
      token = url.searchParams.get("token") || "";
    if (
      !/^[a-f0-9-]{36}$/i.test(storeId) ||
      !/^[a-f0-9-]{36}$/i.test(requestId) ||
      !/^[a-f0-9]{48}$/.test(token)
    )
      throw new Error();
    return { type: "camera", shop, terminal, storeId, requestId, token };
  } catch {
    throw new Error("This QR code is not recognized by Taha Mobiles.");
  }
}
