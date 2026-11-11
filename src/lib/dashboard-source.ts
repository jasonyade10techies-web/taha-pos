import { repositories as r } from "./repositories";
import type { DashboardData, DashboardMetric } from "../types/dashboard";
import { useSessionStore } from "../stores/session-store";
import { permitted } from "../features/auth/services/permission-service";
import {rangeBuckets,shopDate,type DateRange} from './dashboard-range';
import {creditReminderDetails} from './dashboard-actions';
import type {Sale,ReturnRecord} from '../types/demo';
export async function localDashboard(range?:DateRange): Promise<DashboardData> {
  const session = useSessionStore.getState();
  const allow = (key: Parameters<typeof permitted>[2]) =>
    permitted(session.profile, session.permissions, key);
  const sales = (await r.sales.list()).filter((s) => s.status !== "Voided");
  const payments = await r.payments.entries();
  const methods = await r.payments.list();
  const products = await r.products.pos();
  const logs = await r.audit.list();
  const customers = await r.customers.list();
  const ledger = await r.credit.ledger();
  const obligations=allow('credit.create')||allow('credit.receive_payment')?await r.customers.reminders?.()??[]:[];
  const returns = await r.sales.returns();
  const date = shopDate();
  const isToday = (stamp: string) =>
    range?shopDate(new Date(stamp))>=range.from&&shopDate(new Date(stamp))<=range.to:shopDate(new Date(stamp))===date;
  const current = sales.filter((s) => isToday(s.createdAt));
  const todayPayments = payments.filter((p) => isToday(p.createdAt));
  const sumKind = (kind: string) =>
    todayPayments
      .filter((p) => methods.find((m) => m.id === p.methodId)?.kind === kind)
      .reduce(
        (s, p) =>
          s + (["refund", "reversal"].includes(p.kind) ? -p.amount : p.amount),
        0,
      );
  const low = products.filter(
    (p) => p.category !== "Services" && p.quantity <= p.lowStockLevel,
  );
  const snapshot =
    allow("profit.view") && allow("reports.view")
      ? await r.reports.snapshot(range?.from,range?.to)
      : null;
  const todayProfit = snapshot
    ? (await r.reports.snapshot(range?.from||date, range?.to||date)).profit
    : null;
  const bucketValues=(bucketSales:Sale[],bucketReturns:ReturnRecord[])=>{
    const refundedTax=(returned:ReturnRecord)=>{
      if(returned.taxAmount!==undefined)return returned.taxAmount;
      const original=sales.find(s=>s.id===returned.saleId),line=original?.lines.find(l=>l.productId===returned.productId);
      return line?(line.taxAmount??0)*returned.quantity/line.quantity:0;
    };
    const round=(value:number)=>Math.round(value*100)/100;
    const unknown=bucketSales.some(s=>snapshot?.unknownCostSales?.includes(s.id))||bucketReturns.some(r=>snapshot?.unknownCostSales?.includes(r.saleId));
    return {
      sales:round(bucketSales.reduce((n,s)=>n+s.total,0)-bucketReturns.reduce((n,r)=>n+r.amount,0)),
      profit:snapshot&&!unknown?round(bucketSales.reduce((n,s)=>n+s.total-(s.tax?.amount??0)-(snapshot.costBySale[s.id]??0),0)-bucketReturns.reduce((n,r)=>n+r.amount-refundedTax(r)-(snapshot.restoredCostByReturn?.[r.id]??0),0)):null,
    };
  };
  const labels: [string, DashboardMetric["icon"], number | null, string][] = [
    [
      range&&range.label!=="Today"?"Sales":"Today's Sales",
      "sales",
      current.reduce((s, t) => s + t.total, 0) -
        returns
          .filter((t) => isToday(t.createdAt))
          .reduce((s, t) => s + t.amount, 0),
      "Net sales today",
    ],
    [
      "Cash Collected",
      "cash",
      sumKind("Cash"),
      "Sales and old debt collections",
    ],
    [
      "Digital Payments",
      "digital",
      sumKind("Digital"),
      "Confirmed electronic payments",
    ],
    ["Credit Given", "credit", sumKind("Credit"), "Credit extended today"],
    [
      "Gross Profit",
      "profit",
      todayProfit,
      snapshot ? "After returns and restored stock cost" : "Restricted",
    ],
    ["Low Stock", "stock", low.length, "Products at or below reorder level"],
  ];
  return {
    metrics: labels.map(([label, icon, value, detail]) => ({
      label,
      icon,
      value,
      detail,
      change: null,
    })),
    chart: range?rangeBuckets(range).buckets.map(bucket=>{const stamp=(value:string)=>new Date(new Date(value).getTime()+5*60*60_000).toISOString(),ss=sales.filter(s=>stamp(s.createdAt)>=bucket.from&&stamp(s.createdAt)<bucket.to),rr=returns.filter(r=>stamp(r.createdAt)>=bucket.from&&stamp(r.createdAt)<bucket.to);return {day:bucket.day,date:bucket.date,...bucketValues(ss,rr)};}):Array.from({ length: 7 }, (_, i) => {
      const d = new Date(date+'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 6 + i);
      const day = shopDate(d);
      const ss = sales.filter(
        (s) => shopDate(new Date(s.createdAt)) === day,
      );
      const rr=returns.filter(r=>shopDate(new Date(r.createdAt))===day);
      return {
        day: d.toLocaleDateString("en", { weekday: "short",timeZone:'Asia/Karachi' }),
        date:day,
        ...bucketValues(ss,rr),
      };
    }),
    activity: logs.slice(0, 5).map((e, i) => ({
      id: i,
      type: e.module === "Inventory" ? "stock" : "sale",
      text: e.description,
      amount: null,
      time: new Date(e.createdAt).toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    })),
    lowStock: low.slice(0, 5).map((p) => ({
      id:p.id,
      name: p.name,
      code: p.internalCode,
      current: p.quantity,
      minimum: p.lowStockLevel,
      location: p.location
        ? `Rack ${p.location.rack} → ${p.location.shelf} → ${p.location.box}`
        : "Unassigned",
    })),
    credit: customers
      .map((c) => ({
        id:c.id,
        name: c.name,
        initials: c.name.slice(0, 2).toUpperCase(),
        amount: ledger
          .filter((l) => l.customerId === c.id)
          .reduce((s, l) => s + l.debit - l.credit, 0),
        due: "No time limit",
        overdue: false,
      }))
      .filter((c) => c.amount > 0)
      .map(c=>creditReminderDetails(c,obligations))
      .slice(0, 3),
  };
}
