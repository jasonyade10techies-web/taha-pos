import type { Ledger } from "../../types/demo";
import type { CustomerActivity } from "../../types/customer-activity";
import { dueState } from "../../lib/reminders";
import { shopDay, shopTimestamp } from "../../lib/shop-time";
export type HistoryFilter =
  "All" | "Purchases" | "Payments" | "Returns" | "Test Items" | "Notes";
export const historyFilters: HistoryFilter[] = [
  "All",
  "Purchases",
  "Payments",
  "Returns",
  "Test Items",
  "Notes",
];
export function customerLedger(ledger: Ledger[], outstanding: number) {
  const ordered = [...ledger].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  let running =
    Math.round(
      (outstanding - ordered.reduce((sum, l) => sum + l.debit - l.credit, 0)) *
        100,
    ) / 100;
  return ordered.map((entry) => ({
    ...entry,
    balance: (running =
      Math.round((running + entry.debit - entry.credit) * 100) / 100),
  }));
}
export function ledgerKind(
  entry: Ledger,
  events: CustomerActivity[] = [],
): string {
  const kind = (entry as Ledger & { kind?: string }).kind;
  if (kind) return kind;
  const event = events.find(
    (e) => e.entityType === "ledger" && e.entityId === entry.id,
  );
  if (entry.paymentId || event?.title === "Credit Payment Applied")
    return "payment";
  if (
    event?.title === "Return Credit Reversal" ||
    /return/i.test(entry.description)
  )
    return "return";
  if (
    event?.title === "Credit Reversal" ||
    /void|revers/i.test(entry.description)
  )
    return "reversal";
  return entry.debit > 0 ? "charge" : "adjustment";
}
export function ledgerSummary(
  ledger: Ledger[],
  events: CustomerActivity[] = [],
) {
  const result = {
    charged: 0,
    payments: 0,
    returns: 0,
    reversals: 0,
    adjustments: 0,
    reversedPayments: 0,
    totalCredits: 0,
  };
  for (const row of ledger) {
    const kind = ledgerKind(row, events);
    result.totalCredits += row.credit;
    if (row.debit) {
      if (kind === "reversal" || kind === "payment-reversal")
        result.reversedPayments += row.debit;
      else result.charged += row.debit;
    }
    if (row.credit) {
      if (kind === "payment" || kind === "collection")
        result.payments += row.credit;
      else if (kind === "return") result.returns += row.credit;
      else if (kind === "reversal") result.reversals += row.credit;
      else result.adjustments += row.credit;
    }
  }
  return result;
}
export function obligationTiming(
  item: { dueAt?: string; occurredAt: string },
  now = Date.now(),
) {
  if (!item.dueAt)
    return {
      label: "No time limit",
      taken: "Taken on " + shopTimestamp(item.occurredAt),
      overdue: false,
    };
  const state = dueState(item.dueAt, 3, now),
    days = Math.round(
      (Date.parse(shopDay(item.dueAt)) - Date.parse(shopDay(now))) / 86400000,
    );
  const relative =
    state.status === "Overdue"
      ? state.label
      : days > 0
        ? `${days} day${days === 1 ? "" : "s"} left`
        : state.label;
  return {
    label:
      state.status === "Overdue"
        ? `${relative} · Due ${shopTimestamp(item.dueAt)}`
        : `Due ${shopTimestamp(item.dueAt)} · ${relative}`,
    taken: "Taken on " + shopTimestamp(item.occurredAt),
    overdue: state.status === "Overdue",
  };
}
export function historyCategory(event: CustomerActivity): HistoryFilter {
  if (
    event.category === "Sales" ||
    (event.category === "Credit" && event.type === "credit")
  )
    return "Purchases";
  if (event.category === "Credit")
    return event.type.includes("reminder") || event.entityType === "reminder"
      ? "Notes"
      : /return/i.test(event.title)
        ? "Returns"
        : "Payments";
  return event.category as HistoryFilter;
}
export function historyTitle(event: CustomerActivity) {
  if (event.type === "sale")
    return "Purchase" + (/void/i.test(event.title) ? " · later voided" : "");
  if (event.type === "credit") return "Credit charged";
  if (event.type === "payment") return "Payment received";
  if (event.type === "refund") return "Refund recorded";
  if (event.type === "return") return "Product returned";
  return event.title;
}
export function amountDirection(event: CustomerActivity) {
  if (event.type === "sale") return "purchase total";
  if (event.type === "credit") return "charged";
  if (event.type === "payment") return "received";
  if (event.type === "refund") return "refunded";
  if (event.type === "return") return "return value";
  if (event.type === "credit-adjustment" || event.type === "debt-adjustment")
    return "balance reduction";
  return "";
}
/** Load every authorized event before client search/pagination. Never infer completeness from a capped first page. */
export async function allCustomerActivity(
  load: (filter: {
    offset: number;
    limit: number;
    order: "oldest";
  }) => Promise<{ rows: CustomerActivity[]; total: number }>,
) {
  const events: CustomerActivity[] = [];
  let offset = 0,
    total = 0;
  do {
    const page = await load({ offset, limit: 100, order: "oldest" });
    total = page.total;
    if (!page.rows.length && offset < total)
      throw new Error(
        "Account history changed while loading. Refresh to load the complete history.",
      );
    events.push(...page.rows);
    offset += page.rows.length;
  } while (offset < total);
  return [...new Map(events.map((event) => [event.id, event])).values()];
}
