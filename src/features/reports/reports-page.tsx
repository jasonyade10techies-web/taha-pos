import {DatePicker} from "../../components/ui/date-picker";
import {useShopConfiguration} from "../../hooks/use-shop-configuration";
import { AppSelect } from '../../components/ui/app-select';
import { useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository } from "../../hooks/use-repository";
import {
  PageHeader,
  Tabs,
  StatCard,
  FilterBar,
  DataTable,
  QueryState,
  StatusBadge,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { currency } from "../../lib/utils";
import { exportCsv } from "../../lib/export";
import { usePermission } from "../../hooks/use-permission";
import { SalesChart } from "../../components/dashboard/sales-chart";
import { today } from "../shared/format";
function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
}
export function ReportsPage() {
  const [params]=useSearchParams(),{ownerOnly}=useShopConfiguration();
  const metric=params.get("metric");
  const [tab, setTab] = useState(params.get("tab")??"Overview");
  const [range, setRange] = useState("Last 7 Days");
  const [from, setFrom] = useState(params.get("from")??dateOffset(6));
  const [to, setTo] = useState(params.get("to")??today());
  const invalidRange = !!from && !!to && from > to;
  const q = useRepository("reports-" + from + to, () =>
    r.reports.snapshot(from, to),
  !invalidRange);
  const methods = useRepository("methods", () => r.payments.list());
  const canExport = usePermission("reports.export");
  const canProfit=usePermission("profit.view");
  const canInventory = usePermission("inventory.view");
  const canViewSales = usePermission("sales.view");
  const data = q.data;
  const sales = data?.sales.filter((s) => s.status !== "Voided") ?? [];
  const aggregate=data?.aggregate;
  const salesTotal = aggregate?.summary.sales ?? sales.reduce((n, s) => n + s.total, 0);
  const returns = aggregate?.summary.returns ?? data?.returns.reduce((n, s) => n + s.amount, 0) ?? 0;
  const payments =
    aggregate?.methods ?? methods.data?.map((m) => ({
      id: m.id,
      name: m.name,
      total: (data?.payments ?? [])
        .filter((p) => p.methodId === m.id)
        .reduce(
          (n, p) =>
            n +
            (p.kind === "refund" || p.kind === "reversal"
              ? -p.amount
              : p.amount),
          0,
        ),
    })) ?? [];
  const employeeRows =
    aggregate?.employees.map(e=>({...e,full:e.full ?? 0,discounted:e.discounted ?? 0,averageDiscount:e.averageDiscount ?? 0,overrides:e.overrides ?? 0,returns:e.returns ?? 0,cashDifference:e.cashDifference ?? 0})) ?? data?.employees.map((e) => {
      const ss = sales.filter((s) => s.employeeId === e.id);
      const count = ss.length;
      const amount = ss.reduce((n, s) => n + s.total, 0);
      const lines = ss.flatMap((s) => s.lines);
      return {
        id: e.id,
        name: e.full_name,
        transactions: count,
        sales: amount,
        average: count ? amount / count : 0,
        full: lines.filter(
          (l) => l.unitPrice === l.originalPrice && !l.discount,
        ).length,
        discounted: lines.filter(
          (l) => l.unitPrice < l.originalPrice || l.discount,
        ).length,
        averageDiscount: lines.length
          ? ss.reduce((n, s) => n + s.discount, 0) / lines.length
          : 0,
        overrides: lines.filter((l) => l.approval).length,
        collections: data.payments
          .filter((p) => p.employeeId === e.id && p.kind === "collection")
          .reduce((n, p) => n + p.amount, 0),
        returns: data.returns.filter((t) => t.employeeId === e.id).length,
        voids: data.sales.filter(
          (s) => s.employeeId === e.id && s.status === "Voided",
        ).length,
        cashDifference: data.shifts
          .filter(
            (s) =>
              s.employeeId === e.id &&
              s.status === "Closed" &&
              s.date >= from &&
              s.date <= to,
          )
          .reduce((n, s) => n + (s.difference ?? 0), 0),
      };
    }) ?? [];
  const top = new Map<
    string,
    { id: string; name: string; quantity: number; total: number }
  >();
  sales.forEach((s) =>
    s.lines.forEach((l) => {
      const p = top.get(l.productId) ?? {
        id: l.productId,
        name: l.name,
        quantity: 0,
        total: 0,
      };
      p.quantity += l.quantity - (s.returned[l.productId] ?? 0);
      p.total +=
        l.total - ((s.returned[l.productId] ?? 0) * l.total) / l.quantity;
      top.set(p.id, p);
    }),
  );
  const topRows = aggregate?.top ?? [...top.values()].sort((a, b) => b.total - a.total);
  const inventoryRows = data?.products.filter((p) => p.category !== "Services") ?? [];
  const creditRows = aggregate?.credit ?? data?.customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    balance: (data.ledger.filter((entry) => entry.customerId === customer.id))
      .reduce((sum, entry) => sum + entry.debit - entry.credit, 0),
  })) ?? [];
  const inventoryUnavailable = tab === "Inventory" && (!canInventory || !!aggregate);
  const exportReport = () => {
    if (!data || q.isPending || q.isError || invalidRange || inventoryUnavailable) return;
    const filename = `taha-${tab === "Sales" && aggregate ? "recent-receipts" : tab.toLowerCase()}-${from}-${to}`;
    if (tab === "Employees") return exportCsv(filename, employeeRows);
    if (tab === "Payments") return exportCsv(filename, payments);
    if (tab === "Inventory") return exportCsv(filename, inventoryRows.map((product) => ({
      product: product.name, quantity: product.quantity, lowStockLevel: product.lowStockLevel,
      status: product.quantity <= product.lowStockLevel ? "Low Stock" : "In Stock",
    })));
    if (tab === "Credit") return exportCsv(filename, creditRows);
    if (tab === "Profit") return exportCsv(filename, [{
      from, to, grossProfit: data.profit === null ? (canProfit ? "Unavailable" : "Restricted") : data.profit,
    }]);
    if (tab === "Sales") return exportCsv(filename, sales.map((sale) => {
      const record: Record<string, string | number | boolean> = {
        invoice: sale.invoice, customer: sale.customerName, employee: sale.employeeName,
        createdAt: sale.createdAt, total: sale.total, status: sale.status,
      };
      if (aggregate) Object.assign(record, { scope: "Recent receipts (up to 25)", from, to });
      return record;
    }));
    return exportCsv(filename, topRows);
  };
  const chart = aggregate?.chart ?? Array.from({ length: 7 }, (_, i) => {
    const date = dateOffset(6 - i);
    return {
      day: new Date(date + "T12:00").toLocaleDateString("en", {
        weekday: "short",
      }),
      sales: sales
        .filter((s) => s.createdAt.slice(0, 10) === date)
        .reduce((n, s) => n + s.total, 0),
      profit:
        data?.profit === null
          ? null
          : sales
              .filter((s) => s.createdAt.slice(0, 10) === date)
              .reduce((n, s) => n + s.total - (data?.costBySale[s.id] ?? 0), 0),
    };
  });
  return (
    <>
      <PageHeader
        title={metric?({sales:"Sales",cash:"Cash Collected",digital:"Digital Payments",credit:"Credit Given",profit:"Gross Profit"}[metric]??"Report")+" breakdown":"Reports"}
        subtitle={aggregate ? "Server aggregates; debt collections are reported separately from sales revenue." : "Metrics derived from local sales, movements and payments."}
        action={
          canExport ? (
            <Button
              disabled={q.isPending || q.isError || invalidRange || inventoryUnavailable}
              title={inventoryUnavailable ? "Inventory CSV is unavailable in this report." : undefined}
              onClick={exportReport}
            >
              {tab === "Sales" && aggregate ? "Export Recent Receipts CSV" : "Export CSV"}
            </Button>
          ) : undefined
        }
      />
      {metric&&<section className="panel form-section"><h2>Selected period: {from} to {to}</h2><p>{({sales:'Net sales deduct returns and voids recorded in the selected period. Old-debt collections are not new sales.',cash:'Confirmed cash movements include sale payments and separately reported old-debt collections, less refunds and reversals.',digital:'Confirmed electronic payments, less electronic refunds and reversals.',credit:'Credit issued for sales in this period. Current outstanding account balances are shown separately.',profit:'Authorized gross profit after returns and restored stock cost. Unknown acquisition cost remains unknown.'} as Record<string,string>)[metric]}</p><strong>{(metric==='profit'&&data?.profit==null)?'Unavailable until acquisition costs are complete':currency(metric==='sales'?salesTotal-returns:metric==='cash'?aggregate?.summary.cash??payments.filter(m=>methods.data?.find(v=>v.id===m.id)?.kind==='Cash').reduce((n,m)=>n+m.total,0):metric==='digital'?aggregate?.summary.digital??payments.filter(m=>methods.data?.find(v=>v.id===m.id)?.kind==='Digital').reduce((n,m)=>n+m.total,0):metric==='credit'?aggregate?.summary.creditGiven??payments.filter(m=>methods.data?.find(v=>v.id===m.id)?.kind==='Credit').reduce((n,m)=>n+m.total,0):data?.profit??0)}</strong></section>}
      <FilterBar>
        <AppSelect
          className="input"
          aria-label="Report date range"
          value={range}
          onChange={(e) => {
            const value = e.target.value;
            setRange(value);
            if (value !== "Custom") {
              setFrom(
                dateOffset(
                  value === "Today"
                    ? 0
                    : value === "Yesterday"
                      ? 1
                      : value === "Last 7 Days"
                        ? 6
                        : 29,
                ),
              );
              setTo(value === "Yesterday" ? dateOffset(1) : today());
            }
          }}
        >
          {["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Custom"].map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </AppSelect>
        <DatePicker label="Report start date" value={from} max={to||undefined} onChange={value=>{setRange("Custom");setFrom(value);}}/>
        <DatePicker label="Report end date" value={to} min={from||undefined} onChange={value=>{setRange("Custom");setTo(value);}}/>
      </FilterBar>
      <Tabs
        items={[
          "Overview",
          "Sales",
          "Profit",
          "Inventory",
          "Payments",
          "Credit",
          ...(!ownerOnly?["Employees"]:[]),
        ]}
        value={tab}
        onChange={setTab}
      />
      {invalidRange ? <p role="alert" className="form-error">Start date must be on or before end date.</p> : <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <div className="stat-grid">
          <StatCard label="Net Sales" value={currency(salesTotal - returns)} />
          <StatCard label="Transactions" value={aggregate?.summary.transactions ?? sales.length} />
          <StatCard
            label="Average Sale"
            value={currency((aggregate?.summary.transactions ?? sales.length) ? salesTotal / (aggregate?.summary.transactions ?? sales.length) : 0)}
          />
          <StatCard
            label="Gross Profit"
            value={
              data?.profit === null ? canProfit ? "Unavailable" : "Restricted" : currency(data?.profit ?? 0)
            }
          />
        </div>
        {aggregate && <div className="stat-grid"><StatCard label="Cash Collected" value={currency(aggregate.summary.cash)}/><StatCard label="Digital Collected" value={currency(aggregate.summary.digital)}/><StatCard label="Credit Given" value={currency(aggregate.summary.creditGiven)}/><StatCard label="Old Debt Collected" value={currency(aggregate.summary.debtCollected)}/><StatCard label="Discounts" value={currency(aggregate.summary.discounts)}/><StatCard label="Returns" value={currency(aggregate.summary.returns)}/></div>}
        {tab === "Overview" ? (
          <>
            <SalesChart data={chart} />
            <h2 className="section-title mt-6 mb-4">Payment Breakdown</h2>
            <div className="stat-grid">
              {payments
                .filter((p) => p.total !== 0)
                .map((p) => (
                  <StatCard
                    key={p.id}
                    label={p.name}
                    value={currency(p.total)}
                  />
                ))}
            </div>
            <h2 className="section-title mt-6">Top Products</h2>
            <DataTable
              rows={topRows.slice(0, 10)}
              columns={[
                { label: "Product", render: (p) => p.name },
                { label: "Units", render: (p) => p.quantity },
                { label: "Net Value", render: (p) => currency(p.total) },
              ]}
            />
          </>
        ) : tab === "Employees" ? (
          <DataTable
            rows={employeeRows}
            columns={[
              { label: "Employee", render: (e) => e.name },
              { label: "Transactions", render: (e) => e.transactions },
              {
                label: "Sales / Average",
                render: (e) => currency(e.sales) + " / " + currency(e.average),
              },
              {
                label: "Full / Discounted",
                render: (e) => e.full + " / " + e.discounted,
              },
              {
                label: "Avg Discount / Overrides",
                render: (e) =>
                  currency(e.averageDiscount) + " / " + e.overrides,
              },
              { label: "Collections", render: (e) => currency(e.collections) },
              {
                label: "Returns / Voids",
                render: (e) => e.returns + " / " + e.voids,
              },
              {
                label: "Cash Difference",
                render: (e) => currency(e.cashDifference),
              },
            ]}
          />
        ) : tab === "Payments" ? (
          <DataTable
            rows={payments}
            columns={[
              { label: "Method", render: (p) => p.name },
              {
                label: "Net Collected / Credit",
                render: (p) => currency(p.total),
              },
            ]}
          />
        ) : tab === "Inventory" && !canInventory ? (
          <section className="panel empty-state">
            <h2>Inventory access restricted</h2>
            <p>Inventory permission is required to view stock.</p>
          </section>
        ) : tab === "Inventory" && aggregate ? (
          <section className="panel empty-state">
            <h2>Inventory report unavailable</h2>
            <p>This server report does not include inventory. Open Stock to inspect current stock conditions and locations.</p>
            <Link className="button button-secondary" to="/stock">Open Stock</Link>
          </section>
        ) : tab === "Inventory" ? (
          <DataTable
            rows={inventoryRows}
            columns={[
              { label: "Product", render: (p) => p.name },
              { label: "Stock", render: (p) => p.quantity },
              { label: "Reorder Level", render: (p) => p.lowStockLevel },
              {
                label: "Status",
                render: (p) => (
                  <StatusBadge
                    status={
                      p.quantity <= p.lowStockLevel ? "Low Stock" : "In Stock"
                    }
                  />
                ),
              },
            ]}
          />
        ) : tab === "Credit" ? (
          <DataTable
            rows={creditRows}
            columns={[
              { label: "Account", render: (c) => c.name },
              {
                label: "Period Credit Balance",
                render: (c) => currency(c.balance),
              },
            ]}
          />
        ) : tab === "Profit" && data?.profit === null ? (
          <section className="panel empty-state">
            <h2>{canProfit ? "Cost snapshots incomplete" : "Access Denied"}</h2>
            <p>{canProfit ? "Some sold products had no acquisition cost recorded. Profit is unavailable for this period." : "Profit permission is required."}</p>
          </section>
        ) : (
          <>
          {aggregate && <div className="form-actions mb-4">
            <p className="text-sm text-muted">Recent receipts · up to 25 in this period. Period totals above include the full report.</p>
            {canViewSales && <Link className="button button-secondary" to={"/transactions?" + new URLSearchParams({ from, to }).toString()}>View All Receipts</Link>}
          </div>}
          <DataTable
            rows={sales}
            columns={[
              { label: "Invoice", render: (s) => s.invoice },
              { label: "Customer", render: (s) => s.customerName },
              { label: "Total", render: (s) => currency(s.total) },
              {
                label: tab === "Profit" ? "Profit before returns" : "Status",
                render: (s) =>
                  tab === "Profit" ? (
                    aggregate ? "Included in aggregate above" : currency(s.total - (data?.costBySale[s.id] ?? 0))
                  ) : (
                    <StatusBadge status={s.status} />
                  ),
              },
            ]}
          />
          </>
        )}
      </QueryState>}
    </>
  );
}
