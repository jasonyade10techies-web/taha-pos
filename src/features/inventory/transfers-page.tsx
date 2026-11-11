import { useState } from "react";
import { Link } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { usePermission } from "../../hooks/use-permission";
import {
  PageHeader,
  QueryState,
  DataTable,
} from "../../components/ui/workspace";
import { SearchableCombobox } from "../../components/ui/searchable-combobox";
import { Button } from "../../components/ui/button";
import { locationPath, physicalProduct } from "./inventory-controls";
import { stamp } from "../shared/format";

export function TransfersPage() {
  const q = useRepository("transfers", async () => {
      const [products, locations, balances, movements] = await Promise.all([
        r.products.list(),
        r.locations.list(),
        r.inventory.balances(),
        r.inventory.movements(),
      ]);
      return {
        products,
        locations,
        balances,
        movements: movements.filter((m) => m.type.startsWith("TRANSFER")),
      };
    }),
    a = useAction(),
    canTransfer = usePermission("inventory.transfer");
  const [product, setProduct] = useState(""),
    [source, setSource] = useState(""),
    [destination, setDestination] = useState(""),
    [quantity, setQuantity] = useState(1);
  const locations = q.data?.locations ?? [],
    sourceLocation = locations.find((l) => l.id === source),
    balance = (id: string) =>
      q.data?.balances
        .filter((b) => b.productId === product && b.locationId === id)
        .reduce((sum, b) => sum + b.quantity, 0) ?? 0,
    sourceBefore = balance(source),
    destinationBefore = balance(destination);
  const boxes = locations.filter(
    (l) =>
      l.kind === "box" &&
      !l.archived &&
      (l.stockCondition ?? "Available") === "Available",
  );
  const valid =
    !!product &&
    !!source &&
    !!destination &&
    source !== destination &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    sourceBefore >= quantity;
  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Move items between storage locations. The total quantity does not change."
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <section className="panel form-section">
          <form
            className="transfer-form"
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(
                async () => {
                  if (!valid)
                    throw new Error(
                      "Choose a product, different compatible destinations and a positive quantity within source stock.",
                    );
                  if (
                    (sourceLocation?.stockCondition ?? "Available") !==
                    (locations.find((l) => l.id === destination)
                      ?.stockCondition ?? "Available")
                  )
                    throw new Error(
                      "A transfer must preserve stock condition.",
                    );
                  await r.inventory.transfer(
                    product,
                    source,
                    destination,
                    quantity,
                  );
                },
                "Stock transferred",
                () => setQuantity(1),
              );
            }}
          >
            <label>
              Selected product
              <SearchableCombobox
                label="Product"
                value={product}
                onChange={(value) => {
                  setProduct(value);
                  setSource("");
                  setDestination("");
                }}
                options={(q.data?.products ?? [])
                  .filter((p) => p.state === "active" && physicalProduct(p))
                  .map((p) => ({
                    value: p.id,
                    label: p.name,
                    description: [p.qualityGrade, p.internalCode].join(" · "),
                  }))}
              />
            </label>
            <label>
              From
              <SearchableCombobox
                label="From"
                value={source}
                onChange={(value) => {
                  setSource(value);
                  setDestination("");
                }}
                disabled={!product}
                options={boxes
                  .filter((l) => balance(l.id) > 0)
                  .map((l) => ({
                    value: l.id,
                    label: locationPath(locations, l.id),
                    description: `${balance(l.id)} sellable units · ${l.code}`,
                  }))}
              />
            </label>
            <label>
              To
              <SearchableCombobox
                label="To"
                value={destination}
                onChange={setDestination}
                disabled={!source}
                options={boxes
                  .filter(
                    (l) =>
                      l.id !== source &&
                      (l.stockCondition ?? "Available") ===
                        (sourceLocation?.stockCondition ?? "Available"),
                  )
                  .map((l) => ({
                    value: l.id,
                    label: locationPath(locations, l.id),
                    description: `${balance(l.id)} units · ${l.code}`,
                  }))}
              />
            </label>
            <label>
              Quantity
              <input
                className="input"
                aria-label="Quantity"
                type="number"
                min="1"
                step="1"
                max={sourceBefore || undefined}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <div className="transfer-review" aria-live="polite">
              <div>
                <span>Source before/after</span>
                <strong>
                  {source
                    ? `${sourceBefore} → ${Math.max(0, sourceBefore - quantity)}`
                    : "Select source"}
                </strong>
              </div>
              <div>
                <span>Destination before/after</span>
                <strong>
                  {destination
                    ? `${destinationBefore} → ${destinationBefore + quantity}`
                    : "Select destination"}
                </strong>
              </div>
              <div>
                <span>Total unchanged</span>
                <strong>
                  {product
                    ? `${sourceBefore + destinationBefore} → ${sourceBefore + destinationBefore}`
                    : "Choose a product"}
                </strong>
                <small>Selected locations · Sellable condition preserved</small>
              </div>
            </div>
            {source && quantity > sourceBefore && (
              <p role="alert" className="text-danger">
                Insufficient source stock: {sourceBefore} units available.
              </p>
            )}
            {a.error && (
              <p role="alert" className="text-danger">
                {a.error}
              </p>
            )}
            <div className="form-actions">
              <span className="text-muted">
                Quarantined items use{" "}
                <Link to="/inventory?condition=Damaged" className="text-link">
                  Damaged Inventory
                </Link>{" "}
                and its audited transfer action.
              </span>
              <Button
                type="submit"
                variant="primary"
                disabled={a.busy || !valid || !canTransfer}
              >
                Transfer Stock
              </Button>
            </div>
          </form>
        </section>
        <h2 className="section-title mt-6">Available stock by location</h2>
        <DataTable
          rows={q.data?.balances.filter((b) => b.quantity > 0) ?? []}
          columns={[
            {
              label: "Product",
              render: (b) => (
                <Link to={"/products/" + b.productId}>
                  {q.data?.products.find((p) => p.id === b.productId)?.name ??
                    "Unknown product"}
                </Link>
              ),
            },
            {
              label: "Storage path",
              render: (b) => (
                <Link to={"/locations/" + b.locationId}>
                  {locationPath(locations, b.locationId)}
                </Link>
              ),
            },
            { label: "Available", render: (b) => b.quantity },
          ]}
        />
        <h2 className="section-title mt-6">Transfer history</h2>
        <DataTable
          rows={q.data?.movements ?? []}
          columns={[
            {
              label: "Product",
              render: (m) =>
                q.data?.products.find((p) => p.id === m.productId)?.name ??
                "Unknown product",
            },
            {
              label: "Storage path",
              render: (m) => (
                <Link to={"/locations/" + m.locationId}>
                  {locationPath(locations, m.locationId)}
                </Link>
              ),
            },
            {
              label: "Type",
              render: (m) =>
                m.type === "TRANSFER_IN" ? "Moved in" : "Moved out",
            },
            { label: "Quantity", render: (m) => m.quantity },
            { label: "Reference", render: (m) => m.reference },
            { label: "Date", render: (m) => stamp(m.createdAt) },
          ]}
        />
      </QueryState>
    </>
  );
}
