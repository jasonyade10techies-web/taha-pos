import type { SaleFilter, SalePage } from "../../types/transactions";
import { demoDb, requireValue } from "./database";
import { allowed } from "./common";
import { shopDay } from "../shop-time";
/** Search is scoped and never chooses a receipt for the cashier. */
export async function receiptSearch(
  filter: SaleFilter = {},
): Promise<SalePage> {
  requireValue(
    allowed("sales.view") || allowed("returns.create"),
    "You do not have permission to look up receipts.",
  );
  const [all, customers] = await Promise.all([
    demoDb.sales.orderBy("createdAt").reverse().toArray(),
    demoDb.customers.toArray(),
  ]);
  const query = (filter.search ?? "").trim().toLocaleLowerCase(),
    matching = all
      .filter((sale) => {
        const phone =
          customers.find((c) => c.id === sale.customerId)?.phone ?? "";
        const phoneDigits=phone.replace(/\D/g,'').replace(/^00/,'').replace(/^0/,'92'),queryDigits=query.replace(/\D/g,'').replace(/^00/,'').replace(/^0/,'92');
        const haystack = [
          sale.invoice,
          sale.customerName,
          phone,
          sale.employeeName,
          shopDay(sale.createdAt),
          ...sale.lines.map((l) => l.name),
        ]
          .join(" ")
          .toLocaleLowerCase();
        return (
          (!query || haystack.includes(query) || queryDigits.length>=6&&phoneDigits.includes(queryDigits)) &&
          (!filter.id || sale.id === filter.id) &&
          (!filter.customer || sale.customerId === filter.customer) &&
          (!filter.employee || sale.employeeId === filter.employee) &&
          (!filter.method ||
            sale.payments.some((p) => p.methodId === filter.method)) &&
          (!filter.status || sale.status === filter.status) &&
          (!filter.from || shopDay(sale.createdAt) >= filter.from) &&
          (!filter.to || shopDay(sale.createdAt) <= filter.to)
        );
      })
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
  const page = Math.max(0, Math.floor(filter.page ?? 0)),
    limit = Math.min(100, Math.max(1, Math.floor(filter.limit ?? 25)));
  const rows = matching.slice(page * limit, (page + 1) * limit).map((sale) => {
    const safe = structuredClone(sale);
    for (const line of safe.lines) {
      delete line.minimumPrice;
      delete line.approval;
      delete line.reason;
      if(line.compound)delete line.compound.productMinimumBasis;
    }
    for (const payment of safe.payments) {
      delete payment.proof;
      delete payment.approvalToken;
    }
    return safe;
  });
  return { rows, total: matching.length, page, limit };
}
