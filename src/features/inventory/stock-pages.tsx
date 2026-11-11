import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository } from "../../hooks/use-repository";
import {
  PageHeader,
  QueryState,
  DataTable,
  Tabs,
  SearchInput,
  FilterBar,
  StatusBadge,
  StatCard,
} from "../../components/ui/workspace";
import { stamp } from "../shared/format";
import { localDemoEnabled } from "../../lib/config";
import { StockAdjustment } from "./stock-adjustment";
import { DamagedInventory } from "./condition-stock";
import { StockAvailability, locationPath } from "./inventory-controls";

export function StockPage({ low = false }: { low?: boolean }) {
  const [params] = useSearchParams();
  const q = useRepository("stock", async () => ({
    products: await r.products.pos(),
    movements: await r.inventory.movements(),
    locations: await r.locations.list(),
    tests: localDemoEnabled ? await r.credit.tests() : [],
    balances: await r.inventory.balances(),
    conditions: (await r.inventory.conditions?.()) ?? [],
  }));
  const [tab, setTab] = useState(
    params.get("condition") === "Damaged" ? "Damaged Returns" : "Stock",
  );
  const [search, setSearch] = useState("");
  const held = (id: string) =>
    q.data?.conditions.find((c) => c.productId === id)?.outForTest ??
    q.data?.tests
      .filter((t) => t.productId === id && t.status === "OUT")
      .reduce((n, t) => n + t.quantity, 0) ??
    0;
  const rows = (q.data?.products ?? []).filter(
    (p) =>
      p.category !== "Services" &&
      (!low || p.quantity <= p.lowStockLevel) &&
      [p.name, p.internalCode, p.compatibleModel]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title={low ? "Low Stock" : "Stock"}
        subtitle={
          low
            ? "Reorder products that need attention."
            : "Live location balances backed by an immutable movement history."
        }
        action={
          <Link className="button button-primary" to="/stock-receiving">
            Receive Stock
          </Link>
        }
      />
      {!low && (
        <div className="stat-grid">
          <StatCard
            label="Total tracked units"
            value={rows.reduce(
              (n, p) =>
                n +
                p.quantity +
                held(p.id) +
                (q.data?.conditions.find((c) => c.productId === p.id)
                  ?.damaged ?? 0),
              0,
            )}
            detail="Sellable + quarantine + out for test, counted once"
          />
          <StatCard
            label="Damaged Units"
            value={
              q.data?.conditions.reduce((sum, item) => sum + item.damaged, 0) ??
              0
            }
            detail="Quarantined and unavailable for sale"
          />
          <StatCard
            label="Low Stock"
            value={
              rows.filter(
                (p) => p.quantity > 0 && p.quantity <= p.lowStockLevel,
              ).length
            }
          />
          <StatCard
            label="Out of Stock"
            value={rows.filter((p) => p.quantity === 0).length}
          />
        </div>
      )}
      {!low && (
        <Tabs
          items={["Stock", "Movements", "Damaged Returns"]}
          value={tab}
          onChange={setTab}
        />
      )}
      {!low && q.data && (
        <StockAdjustment
          products={q.data.products}
          locations={q.data.locations}
          balances={q.data.balances}
        />
      )}
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} />
      </FilterBar>
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {tab === "Stock" ? (
          <DataTable
            rows={rows}
            columns={[
              {
                label: "Product",
                render: (p) => (
                  <Link to={"/products/" + p.id}>
                    <strong>{p.name}</strong>
                    <small className="cell-secondary">
                      {p.qualityGrade} · {p.internalCode}
                    </small>
                  </Link>
                ),
              },
              {
                label: "In shop",
                render: (p) => (
                  <Link
                    title="Sellable and quarantined units physically in the shop. Excludes units held for testing."
                    to={"/products/" + p.id + "?view=stock"}
                  >
                    {p.quantity +
                      (q.data?.conditions.find((c) => c.productId === p.id)
                        ?.damaged ?? 0)}
                  </Link>
                ),
              },
              {
                label: "Damaged",
                render: (p) => {
                  const count =
                    q.data?.conditions.find((c) => c.productId === p.id)
                      ?.damaged ?? 0;
                  return (
                    <button
                      title={`${count} damaged units in quarantine. View history.`}
                      className={`stock-count-link ${count ? "damaged" : ""}`}
                      onClick={() => setTab("Damaged Returns")}
                    >
                      {count}
                    </button>
                  );
                },
              },
              {
                label: "Available · Status",
                render: (p) => (
                  <StockAvailability
                    id={p.id}
                    quantity={p.quantity}
                    minimum={p.lowStockLevel}
                  />
                ),
              },
              {
                label: "Out for Test",
                render: (p) => (
                  <Link
                    title={`${held(p.id)} units temporarily held by customers for testing.`}
                    to={"/products/" + p.id + "?view=history"}
                  >
                    {held(p.id)}
                  </Link>
                ),
              },
              {
                label: "Locations",
                render: (p) => (
                  <Link
                    title="Inspect storage balances and full paths."
                    to={"/products/" + p.id + "?view=stock"}
                  >
                    {q.data?.balances.filter(
                      (b) => b.productId === p.id && b.quantity > 0,
                    ).length ?? 0}
                  </Link>
                ),
              },
              { label: "Minimum", render: (p) => p.lowStockLevel },
              {
                label: "Location",
                render: (p) => {
                  const balance = q.data?.balances.find(
                    (b) => b.productId === p.id && b.quantity > 0,
                  );
                  return balance ? (
                    <Link to={"/locations/" + balance.locationId}>
                      {locationPath(
                        q.data?.locations ?? [],
                        balance.locationId,
                      )}
                    </Link>
                  ) : (
                    <span title="No storage balance assigned yet.">
                      Unassigned
                    </span>
                  );
                },
              },
              {
                label: "Action",
                render: (p) => (
                  <Link
                    className="text-link"
                    to={
                      "/stock-receiving?product=" +
                      p.id +
                      "&quantity=" +
                      Math.max(1, p.lowStockLevel * 2 - p.quantity)
                    }
                  >
                    Reorder
                  </Link>
                ),
              },
            ]}
          />
        ) : tab === "Damaged Returns" ? (
          <DamagedInventory />
        ) : (
          <DataTable
            rows={
              q.data?.movements.filter(
                (m) =>
                  !search ||
                  q.data?.products
                    .find((p) => p.id === m.productId)
                    ?.name.toLowerCase()
                    .includes(search.toLowerCase()),
              ) ?? []
            }
            columns={[
              {
                label: "Movement",
                render: (m) => <StatusBadge status={m.type} />,
              },
              {
                label: "Product",
                render: (m) =>
                  q.data?.products.find((p) => p.id === m.productId)?.name ??
                  m.productId,
              },
              { label: "Quantity", render: (m) => m.quantity },
              {
                label: "Location",
                render: (m) =>
                  q.data?.locations.find((l) => l.id === m.locationId)?.code,
              },
              { label: "Reference", render: (m) => m.reference },
              { label: "Date", render: (m) => stamp(m.createdAt) },
            ]}
          />
        )}
      </QueryState>
    </>
  );
}

export { ReceivingPage } from "./receiving-page";
export { TransfersPage } from "./transfers-page";
