import {cachedCounterRead} from './read-cache';
import {nativeDesktop} from '../desktop/runtime';
import {sqliteReceipts} from '../desktop/database';
import {completeDesktopCash} from '../desktop/sales';
import type { Repositories } from "../repositories/interfaces";
import type { Customer, Ledger, Payment, Sale, ReturnRecord, TestOut, PaymentMethod, Coupon, DemoSettings } from "../../types/demo";
import type { SaleFilter, SalePage, TransactionReport } from "../../types/transactions";
import { apiMediaUrls, apiStoreMedia } from "./media";
import { read, write } from "./catalog-repositories";
import { permitted } from "../../features/auth/services/permission-service";
import { useSessionStore } from "../../stores/session-store";
const query = (filter: object) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== "") params.set(key, String(value)); return params.toString(); };
export const apiSales: Repositories["sales"] = {
  lookup:(filter)=>read<SalePage>(`/returns/receipts?${query(filter)}`),
  page: (filter: SaleFilter) => read<SalePage>(`/sales?${query(filter)}`),
  async list() { return (await this.page!({ limit: 100 })).rows; },
  async get(id) {if(nativeDesktop){const local=(await sqliteReceipts()).find(s=>s.id===id||s.offlineId===id);if(local)return local;}return await read<Sale | null>(`/sales/${id}`) ?? undefined; },
  async complete(input) {if(nativeDesktop){const methods=await apiPayments.list();if(input.payments.length===1&&methods.find(m=>m.id===input.payments[0].methodId)?.kind==='Cash'&&!input.lines.some(l=>l.customService||l.approval)&&!input.coupon&&!input.sourceTestId)return completeDesktopCash(input);}const payments = await Promise.all(input.payments.map(async p => ({ ...p, proof: await apiStoreMedia(p.proof ?? "", "proof") }))); return write<Sale>("/sales", { ...input, payments }); },
  async void(id) { await write(`/sales/${id}/void`, { idempotencyKey: crypto.randomUUID(), reason: "Sale void confirmed by operator", manualRefundConfirmed: true }); },
  returnItem: (saleId, productId, quantity, reason, destination, approval, options = {}) => write<ReturnRecord>("/returns", { saleId, productId, quantity, reason, destination, approvalToken: approval, ...options, idempotencyKey: options.idempotencyKey ?? crypto.randomUUID() }),
  returns: (saleId) => read<ReturnRecord[]>("/returns"+(saleId?'?'+query({saleId}):'')),
};
async function customers(filter = {}) {
  const rows = await read<Customer[]>(`/customers?${query(filter)}`), urls = await apiMediaUrls(rows.map(c => c.photo));
  return rows.map(c => ({ ...c, photoPath: c.photo, photo: urls[c.photo] ?? "" }));
}
export const apiCustomers: Repositories["customers"] = {
  reminders:id=>read(`/reminders?${query({customerId:id})}`),
  reminderAlerts:()=>read('/reminders/alerts'),
  recordReminder:input=>write('/reminders/history',input),
  activityDetail:(id,eventId)=>read(`/customers/${encodeURIComponent(id)}/activity/${encodeURIComponent(eventId)}`),
  timeline:(id,filter={})=>read(`/customers/${encodeURIComponent(id)}/activity?${query(filter)}`),
  addNote:(id,input)=>write(`/customers/${encodeURIComponent(id)}/notes`,input),
  list: () => cachedCounterRead('customers',()=>customers({ limit: 250 })),
  async get(id) { return (await customers({ id }))[0]; },
  async save(c) { const photo = await apiStoreMedia(c.photo, "customer", c.photoPath, c.id);const session=useSessionStore.getState(),payload:Partial<Customer>={...c,photo};if(!permitted(session.profile,session.permissions,'credit.create')&&!permitted(session.profile,session.permissions,'customers.credit')){delete payload.creditLimit;delete payload.creditEnabled;delete payload.enforceCreditLimit;delete payload.dueAt;delete payload.reminderEnabled;} const id = await write<string>("/customers", payload); return (await this.get(id))!; },
  outstanding: id => read<number>(`/customers/${id}/balance`),
};
export const apiCredit: Repositories["credit"] = {
  ledger: customerId => read<Ledger[]>(customerId?`/credit/ledger/full?${query({customerId})}`:'/credit/ledger'),
  async receive(customerId, amount, methodId, reference, notes, options = {}) { const proof = await apiStoreMedia(options.proof ?? "", "proof"); const payment = await write<Payment>("/credit/receive", { customerId, amount, methodId, reference, notes, ...options, proof, idempotencyKey: options.idempotencyKey ?? crypto.randomUUID() }); return payment.code; },
  tests: () => read<TestOut[]>("/out-for-test"),
  send: t => write<TestOut>("/out-for-test", { ...t, idempotencyKey: t.id }),
  async returnTest(id, locationId) { await write("/out-for-test/update", { id, locationId, action: "return", idempotencyKey: crypto.randomUUID() }); },
  async extendTest(id, dueDate) { await write("/out-for-test/update", { id, dueDate, action: "extend", idempotencyKey: crypto.randomUUID() }); },
};
export const apiPayments: Repositories["payments"] = {
  async list() {return cachedCounterRead('payment-methods',async()=>{const rows = await read<PaymentMethod[]>("/payment-methods"), urls = await apiMediaUrls(rows.map(m => m.qr)); return rows.map(m => ({ ...m, qrPath: m.qr, qr: urls[m.qr] ?? "" }));});},
  async get(id) { return (await this.list()).find(m => m.id === id); },
  async save(m) { const qr = await apiStoreMedia(m.qr, "payment-qr", m.qrPath); const id = await write<string>("/payment-methods", { ...m, qr }); return (await this.get(id))!; },
  entries: () => read<Payment[]>("/payments"),
  async reverse(paymentId, reason) { await write("/payments/reverse", { paymentId, reason, idempotencyKey: crypto.randomUUID() }); },
};
export const apiCoupons: Repositories["coupons"] = {
  list: () => read<Coupon[]>("/coupons"), async get(id) { return (await this.list()).find(c => c.id === id); },
  async save(c) { const id = await write<string>("/coupons", c); return (await this.get(id))!; },
  validate: (code, lines, customerId) => write("/coupons/quote", { code, lines: lines.map(l => ({ productId: l.product.id, customService: l.product.customService, quantity: l.quantity, unitPrice: l.unitPrice })), customerId: customerId || null }),
};
export const apiSettings: Repositories["settings"] = { async get() {const settings=await cachedCounterRead("settings",()=>read<DemoSettings>("/settings"));return {...settings,mobileCameraRequireProof:settings.requireProof};}, async save(input) { await write("/settings", input, "PUT"); } };
export const apiReports: Repositories["reports"] = {
  async snapshot(from, to) { const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }); const filters = query({ from: from ?? today, to: to ?? today }); const [aggregate, employees] = await Promise.all([read<TransactionReport>(`/reports?${filters}`), read<TransactionReport["employees"]>(`/reports/employees?${filters}`)]); return { aggregate: { ...aggregate, employees }, sales: aggregate.recentSales, payments: [], returns: [], ledger: [], products: [], customers: [], employees: [], shifts: [], profit: aggregate.profit, costBySale: {} }; },
};
export function canReadCredit() { const s = useSessionStore.getState(); return permitted(s.profile, s.permissions, "credit.create") || permitted(s.profile, s.permissions, "credit.receive_payment"); }
