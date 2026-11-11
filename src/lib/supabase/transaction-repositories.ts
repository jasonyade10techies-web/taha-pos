import type { Repositories } from "../repositories/interfaces";
import type { Customer, Coupon, Ledger, Payment, PaymentMethod, ReturnRecord, SaleInput, TestOut, DemoSettings } from "../../types/demo";
import type { Json } from "../../types/database";
import { activeStore, allowed, rpc } from "./repository-utils";
import { assetUrls, storeAsset } from "./business-assets";
import {useSessionStore} from "../../stores/session-store";
export const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;
export async function transactionData<T>(kind: string, filter = {}): Promise<T> {
  return await rpc("transaction_data",{p_store_id:activeStore(),p_kind:kind,p_filter:json(filter)}) as unknown as T;
}
// Persist request IDs and payload digests only, never a customer's financial/cart data.
// A failed/uncertain request retains its key across refresh; confirmed requests release it.
async function retryWrite<T>(operation: string, payload: unknown, write: (id:string)=>Promise<T>, initialId?:string) {
  const fingerprint=JSON.stringify(payload,(key,value)=>["idempotencyKey","cartId","approvalToken","token","expiresAt","createdAt"].includes(key)?undefined:value);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(fingerprint)))].map(b=>b.toString(16).padStart(2,"0")).join("");
  const key = `taha-request:${activeStore()}:${useSessionStore.getState().profile?.id}:${operation}:${hash}`;
  const binding = initialId ? `taha-request-binding:${activeStore()}:${useSessionStore.getState().profile?.id}:${operation}:${initialId}` : "";
  const boundHash = binding ? sessionStorage.getItem(binding) : null;
  const id = sessionStorage.getItem(key) ?? (initialId && (!boundHash || boundHash===hash) ? initialId : crypto.randomUUID());
  sessionStorage.setItem(key,id);
  if (binding && !boundHash) sessionStorage.setItem(binding,hash);
  const recorded=await rpc("get_transaction_result",{p_store_id:activeStore(),p_operation:operation,p_request_id:id});
  if(recorded!==null){sessionStorage.removeItem(key);return recorded as unknown as T;}
  const result = await write(id); sessionStorage.removeItem(key); return result;
}
async function complete(input: SaleInput) {
  const payments = await Promise.all(input.payments.map(async p => ({...p,proof:await storeAsset(p.proof ?? "","proof")})));
  const payload={...input,payments};
  return retryWrite("sale",payload,id=>rpc("complete_sale",{p_store_id:activeStore(),p_input:json({...payload,idempotencyKey:id})}),input.idempotencyKey);
}
export const remoteSales: Repositories["sales"] = {
  page: filter => rpc("list_sales",{p_store_id:activeStore(),p_filter:json(filter)}),
  async list() { return (await this.page!({limit:100})).rows; },
  async get(id) { return (await rpc("get_sale",{p_store_id:activeStore(),p_id:id})) ?? undefined; },
  complete,
  async void(id) {
    const payload = {saleId:id,reason:"Sale void confirmed by operator",manualRefundConfirmed:true};
    await retryWrite("void",payload,key=>rpc("void_sale",{p_store_id:activeStore(),p_input:json({...payload,idempotencyKey:key})}));
  },
  async returnItem(saleId,productId,quantity,reason,destination,approval,options = {}) {
    const payload = {saleId,productId,quantity,reason,destination,approvalToken:options.approvalToken ?? approval,...options};
    return retryWrite("return",payload,key=>rpc("return_sale_item",{p_store_id:activeStore(),p_input:json({...payload,idempotencyKey:key})}),options.idempotencyKey);
  },
  returns: () => transactionData<ReturnRecord[]>("returns"),
};
async function customers(filter = {}) {
  const rows = await transactionData<Customer[]>("customers",filter);
  const urls = await assetUrls(rows.map(c=>c.photo).filter(Boolean));
  return Promise.all(rows.map(async c=>({...c,photoPath:c.photo,photo:urls.get(c.photo) ?? "",outstanding:allowed("credit.create") || allowed("credit.receive_payment") ? await rpc("get_customer_balance",{p_store_id:activeStore(),p_customer_id:c.id}) : undefined})));
}
export const remoteCustomers: Repositories["customers"] = {
  list:()=>customers({limit:250}),
  async get(id) { return (await customers({id}))[0]; },
  async save(c) {
    const photo = await storeAsset(c.photo,"customers",c.photoPath);
    const id = await rpc("save_customer",{p_store_id:activeStore(),p_input:json({...c,photo})});
    return (await this.get(id))!;
  },
  outstanding: async id=>Number(await rpc("get_customer_balance",{p_store_id:activeStore(),p_customer_id:id})),
};
export const remoteCredit: Repositories["credit"] = {
  ledger: customerId=>transactionData<Ledger[]>("ledger",{customerId,limit:250}),
  async receive(customerId,amount,methodId,reference,notes,options = {}) {
    const proof = await storeAsset(options.proof ?? "","proof");
    const payload = {customerId,amount,methodId,reference,notes,...options,proof};
    const payment = await retryWrite("collection",payload,key=>rpc("receive_credit_payment",{p_store_id:activeStore(),p_input:json({...payload,idempotencyKey:key})}),options.idempotencyKey);
    return payment.code;
  },
  tests:()=>transactionData<TestOut[]>("tests"),
  async send(t) { return await rpc("save_test_out",{p_store_id:activeStore(),p_input:json({...t,idempotencyKey:t.id})}) as unknown as TestOut; },
  async returnTest(id,locationId) {
    await retryWrite("test_update",{id,locationId,action:"return"},key=>rpc("update_test_out",{p_store_id:activeStore(),p_input:json({id,locationId,action:"return",idempotencyKey:key})}));
  },
  async extendTest(id,dueDate) {
    await retryWrite("test_update",{id,dueDate,action:"extend"},key=>rpc("update_test_out",{p_store_id:activeStore(),p_input:json({id,dueDate,action:"extend",idempotencyKey:key})}));
  },
};
export const remotePayments: Repositories["payments"] = {
  async list() {
    const rows = await transactionData<PaymentMethod[]>("methods");
    const urls = await assetUrls(rows.map(m=>m.qr).filter(Boolean));
    return rows.map(m=>({...m,qrPath:m.qr,qr:urls.get(m.qr) ?? ""}));
  },
  async get(id) { return (await this.list()).find(m=>m.id===id); },
  async save(m) {
    const qr = await storeAsset(m.qr,"payment-qr",m.qrPath);
    const id = await rpc("save_payment_method",{p_store_id:activeStore(),p_input:json({...m,qr})});
    return (await this.get(id))!;
  },
  entries:()=>transactionData<Payment[]>("payments"),
  async reverse(paymentId,reason) {
    await retryWrite("payment_reversal",{paymentId,reason},key=>rpc("reverse_payment",{p_store_id:activeStore(),p_input:json({paymentId,reason,idempotencyKey:key})}));
  },
};
export const remoteCoupons: Repositories["coupons"] = {
  list:()=>transactionData<Coupon[]>("coupons"),
  async get(id) { return (await this.list()).find(c=>c.id===id); },
  async save(c) { const id = await rpc("save_coupon",{p_store_id:activeStore(),p_input:json(c)}); return (await this.get(id))!; },
  validate:(code,lines,customerId)=>rpc("quote_coupon",{p_store_id:activeStore(),p_code:code,p_lines:json(lines.map(l=>({productId:l.product.id,quantity:l.quantity,unitPrice:l.unitPrice}))),p_customer_id:customerId || null}),
};
export const remoteSettings: Repositories["settings"] = {
  get: async()=>await rpc("get_business_settings",{p_store_id:activeStore()}) as unknown as DemoSettings,
  async save(settings) { await rpc("save_business_settings",{p_store_id:activeStore(),p_input:json(settings)}); },
};
export const remoteReports: Repositories["reports"] = {
  async snapshot(from,to) {
    const date = new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Karachi"});
    const [aggregate, employees] = await Promise.all([
      rpc("get_transaction_report",{p_store_id:activeStore(),p_from:from ?? date,p_to:to ?? date}),
      rpc("get_employee_report",{p_store_id:activeStore(),p_from:from ?? date,p_to:to ?? date}),
    ]);
    return {aggregate:{...aggregate,employees},sales:aggregate.recentSales,payments:[],returns:[],ledger:[],products:[],customers:[],employees:[],shifts:[],profit:aggregate.profit,costBySale:{}};
  },
};
