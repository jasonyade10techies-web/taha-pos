import { ProductBulkActions } from "./product-bulk-actions";
import './product-toolbar.css';
import { AppCheckbox } from "../../components/ui/app-checkbox";
import { searchProducts } from "../../lib/product-search";
import { cleanDescription } from "../../lib/description";
import { useSearchParams } from "react-router-dom";
import { getProductDraft } from "../../lib/product-drafts";
import { ProductDraftsPanel } from "./product-drafts-panel";
import { AppSelect } from "../../components/ui/app-select";
import { ProductEditor } from "./product-editor";
import { ProductThumbnail } from "../../components/ui/product-thumbnail";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Download, Copy, Archive, Pencil } from "lucide-react";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  SearchInput,
  DataTable,
  StatusBadge,
  PriceBadge,
  QueryState,
  Tabs,
  ConfirmDialog,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { usePermission } from "../../hooks/use-permission";
import { exportCsv } from "../../lib/export";
import { currency } from "../../lib/utils";
import { text, stamp } from "../shared/format";
import type { DemoProduct } from "../../types/demo";
import { localDemoEnabled } from "../../lib/config";
import { allowed } from "../../lib/supabase/repository-utils";
import { DamagedInventory } from "./condition-stock";
import {
  StockAvailability,
  ProductGalleryPreview,
  locationPath,
} from "./inventory-controls";
import { Dialog } from "../../components/ui/dialog";
import { SearchableCombobox } from "../../components/ui/searchable-combobox";

export function ProductsPage() {
  const conditions = useRepository(
    "catalog-conditions",
    () => r.inventory.conditions?.() ?? Promise.resolve([]),
  );
  const q = useRepository("products", () => r.products.pos());
  const all = useRepository("catalog", () => r.products.list());
  const settings = useRepository("product-search-settings", () =>
    r.settings.get(),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [grade, setGrade] = useState("");
  const [status, setStatus] = useState("");
  const [model, setModel] = useState("");
  const navigate = useNavigate();
  const create = usePermission("products.create");
  const products = (q.data ?? []).filter((p) => p.category !== "Services");
  const matching = new Set(
    searchProducts(all.data ?? [], search, settings.data?.searchDictionary).map(
      (product) => product.id,
    ),
  );
  const rows = (all.data ?? [])
    .map((p) => ({
      ...p,
      quantity: products.find((item) => item.id === p.id)?.quantity ?? 0,
    }))
    .filter(
      (p) =>
        matching.has(p.id) &&
        (!category || p.category === category) &&
        (!brand || p.brand === brand) &&
        (!grade || p.qualityGrade === grade) &&
        (!model || p.compatibleModel === model) &&
        (!status ||
          (status === "archived"
            ? p.state === "archived"
            : p.state === "active" &&
              (status === "Out of Stock"
                ? p.quantity === 0
                : status === "Low Stock"
                  ? p.quantity > 0 && p.quantity <= p.lowStockLevel
                  : p.quantity > p.lowStockLevel))),
    );
  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Your catalog, variants, prices and available stock."
        action={
          create ? (
            <>
              <Link className="button button-secondary" to="/stock-receiving">
                Receive Stock
              </Link>
              <Link className="button button-primary" to="/products/new">
                <Plus size={16} />
                Add Product
              </Link>
            </>
          ) : undefined
        }
      />
      <div className="filter-bar products-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Name, model, local name or code…"
        />
        {[
          [category, setCategory, "Category", "category"],
          [brand, setBrand, "Brand", "brand"],
          [model, setModel, "Model", "compatibleModel"],
          [grade, setGrade, "Grade", "qualityGrade"],
        ].map(([value, set, label, key]) => (
          <SearchableCombobox
            key={String(label)}
            label={String(label)}
            placeholder={label === 'Category' ? 'All categories' : `All ${String(label).toLowerCase()}s`}
            value={String(value)}
            onChange={(next) => (set as (s: string) => void)(next)}
            options={Array.from(
              new Set(
                (all.data ?? []).map((p) => text(p[key as keyof DemoProduct])),
              ),
            )
              .filter(Boolean)
              .map((v) => ({ value: v, label: v }))}
          />
        ))}
        <AppSelect
          aria-label="Stock status"
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["In Stock", "Low Stock", "Out of Stock", "archived"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </AppSelect>
        <Button
          onClick={() =>
            exportCsv(
              "products",
              rows.map((p) => ({
                Code: p.internalCode,
                Name: p.name,
                Category: p.category,
                Price: p.sellingPrice,
                Minimum: p.minimumSellingPrice,
                Stock: p.quantity,
                State: p.state,
              })),
            )
          }
        >
          <Download size={16} />
          Export
        </Button>
        <Link className="button button-secondary" to="/products/import">
          Import
        </Link>
      </div>
      <ProductBulkActions
        products={rows}
        selected={selected}
        onSelect={setSelected}
      />
      <ProductDraftsPanel />
      <QueryState
        pending={q.isPending || all.isPending}
        error={q.isError || all.isError}
        retry={() => {
          void q.refetch();
          void all.refetch();
        }}
      >
        <DataTable
          rows={rows}
          onRow={(p) => navigate("/products/" + p.id)}
          columns={[
            {
              label: "Select",
              className: "product-select-column",
              render: (p) => (
                <AppCheckbox
                  aria-label={`Select ${p.name}`}
                  checked={selected.includes(p.id)}
                  onChange={(event) =>
                    setSelected((old) =>
                      event.target.checked
                        ? [...old, p.id]
                        : old.filter((id) => id !== p.id),
                    )
                  }
                />
              ),
            },
            {
              label: "Product",
              render: (p) => (
                <div className="flex items-center gap-3">
                  <ProductThumbnail product={p} small />
                  <Link to={"/products/" + p.id}>
                    <strong>{p.name}</strong>
                    <small className="cell-secondary">
                      {p.internalCode} · {p.compatibleModel}
                    </small>
                  </Link>
                </div>
              ),
            },
            {
              label: "Variant",
              render: (p) => p.qualityGrade + " · " + p.color,
            },
            {
              label: "Location",
              render: (p) =>
                products.find((item) => item.id === p.id)?.location
                  ? Object.values(
                      products.find((item) => item.id === p.id)!.location!,
                    ).join(" → ")
                  : "—",
            },
            {
              label: "Price",
              render: (p) => <PriceBadge value={p.sellingPrice} />,
            },
            {
              label: "Minimum",
              render: (p) => currency(p.minimumSellingPrice),
            },
            {
              label: "Available · Status",
              render: (p) => (
                <StockAvailability
                  id={p.id}
                  quantity={p.quantity}
                  minimum={p.lowStockLevel}
                  archived={p.state === "archived"}
                />
              ),
            },
            {
              label: "Damaged",
              render: (p) => {
                const count =
                  conditions.data?.find((c) => c.productId === p.id)?.damaged ??
                  0;
                return (
                  <Link
                    title={`${count} damaged units in quarantine. View condition history.`}
                    className={`stock-count-link ${count ? "damaged" : ""}`}
                    to={"/products/" + p.id + "?view=stock"}
                  >
                    {count}
                  </Link>
                );
              },
            },
            {
              label: "Out for Test",
              render: (p) =>
                conditions.data?.find((c) => c.productId === p.id)
                  ?.outForTest ?? 0,
            },
            {
              label: "Actions",
              render: (p) => (
                <Link className="text-link" to={"/products/" + p.id}>
                  View / Manage
                </Link>
              ),
            },
          ]}
        />
      </QueryState>
    </>
  );
}

export function ProductFormPage() {
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const { id } = useParams();
  const q = useRepository("product-form-" + id + "-" + draftId, async () => ({
    product: draftId
      ? (await getProductDraft(draftId))?.input
      : id
        ? await r.products.get(id)
        : undefined,
    locations: await r.locations.list(),
    cost: id ? await r.products.cost(id) : null,
    settings: await r.settings.get(),
  }));
  const cost = usePermission("costs.view_purchase_cost");
  const p = q.data?.product;
  return (
    <>
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data && (
          <ProductEditor
            key={draftId ?? id ?? "new"}
            initial={
              p
                ? {
                    ...p,
                    initialQuantity:
                      draftId && "initialQuantity" in p ? p.initialQuantity : 0,
                    ...(cost
                      ? {
                          purchaseCost:
                            draftId && "purchaseCost" in p
                              ? p.purchaseCost
                              : (q.data.cost ?? undefined),
                        }
                      : { purchaseCost: undefined }),
                  }
                : {
                    name: "",
                    category: "Parts",
                    brand: "",
                    compatibleModel: "",
                    qualityGrade: "Grade A",
                    color: "Black",
                    sellingPrice: 0,
                    minimumSellingPrice: 0,
                    locationId: "",
                    aliases: [],
                    lowStockLevel: 5,
                    variant: "",
                    unit: q.data.settings.defaultUnit,
                    notes: "",
                    image: "",
                    state: "active",
                    initialQuantity: 0,
                    ...(cost ? { purchaseCost: undefined } : {}),
                  }
            }
            locations={q.data.locations}
            admin={cost}
          />
        )}
      </QueryState>
    </>
  );
}

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const condition = useRepository(
    "condition-overview-" + id,
    () => r.inventory.conditions?.(id) ?? Promise.resolve([]),
  );
  const q = useRepository("product-detail-" + id, async () => {
    // These reads are independent; one slow round trip must not delay every tab.
    const [
      product,
      products,
      cost,
      movements,
      sales,
      balances,
      locations,
      audit,
    ] = await Promise.all([
      r.products.get(id),
      r.products.pos(),
      r.products.cost(id),
      r.inventory.movements(),
      localDemoEnabled ? r.sales.list() : Promise.resolve([]),
      r.inventory.balances(),
      r.locations.list(),
      localDemoEnabled || allowed("audit.view")
        ? r.audit.list()
        : Promise.resolve([]),
    ]);
    return {
      product,
      stock: products.find((p) => p.id === id),
      cost,
      movements: movements.filter((m) => m.productId === id),
      sales: sales.filter((s) => s.lines.some((l) => l.productId === id)),
      balances: balances.filter((b) => b.productId === id),
      locations,
      audit,
    };
  });
  const a = useAction();
  const navigate = useNavigate();
  const [tab, setTab] = useState(
    params.get("view") === "stock"
      ? "Stock & Locations"
      : params.get("view") === "history"
        ? "History"
        : "Overview",
  );
  const [damaged, setDamaged] = useState(false);
  const [archive, setArchive] = useState(false);
  const edit = usePermission("products.edit");
  const create = usePermission("products.create");
  const canArchive = usePermission("products.archive");
  const profit = usePermission("profit.view");
  const p = q.data?.product;
  return (
    <>
      <PageHeader
        title={p?.name ?? "Product Details"}
        subtitle={p?.internalCode ?? "Loading catalog record…"}
        action={
          p ? (
            <>
              <StatusBadge
                status={p.state === "active" ? "Active" : "Archived"}
              />
              {edit && (
                <Link
                  className="button button-secondary"
                  to={"/products/" + id + "/edit"}
                >
                  <Pencil size={16} />
                  Edit
                </Link>
              )}
              {create && (
                <Button
                  disabled={a.busy}
                  onClick={() =>
                    void a.run(
                      () => r.products.duplicate(id),
                      "Product duplicated",
                      (result) => navigate("/products/" + result.id),
                    )
                  }
                >
                  <Copy size={16} />
                  Duplicate
                </Button>
              )}
              {canArchive && (
                <Button onClick={() => setArchive(true)}>
                  <Archive size={16} />
                  Archive
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      <Tabs
        items={["Overview", "Stock & Locations", "History"]}
        value={tab}
        onChange={setTab}
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {!p ? (
          <p>Product not found.</p>
        ) : tab === "Overview" ? (
          <section className="panel product-detail-workspace">
            <ProductGalleryPreview key={id} product={p} />
            <div className="product-detail-information">
              <div className="product-detail-keyline">
                <strong>{currency(p.sellingPrice)}</strong>
                <StockAvailability
                  id={id}
                  quantity={q.data?.stock?.quantity ?? 0}
                  minimum={p.lowStockLevel}
                  archived={p.state === "archived"}
                  onClick={() => setTab("Stock & Locations")}
                />
              </div>
              <div className="detail-grid">
                {Object.entries({
                  Model: p.compatibleModel,
                  Brand: p.brand,
                  Category: p.category,
                  Grade: p.qualityGrade,
                  Color: p.color,
                  "Minimum Price": currency(p.minimumSellingPrice),
                  "Low Stock Level": p.lowStockLevel,
                  Unit: p.unit,
                  Aliases: p.aliases.join(", "),
                  Notes: p.notes,
                  Status: p.state,
                }).map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>{v === "" ? "—" : v}</strong>
                  </div>
                ))}
              </div>
              <div className="product-detail-keyline">
                <button
                  type="button"
                  className={`stock-count-link ${condition.data?.[0]?.damaged ? "damaged" : ""}`}
                  title={`${condition.data?.[0]?.damaged ?? 0} damaged units in quarantine.`}
                  onClick={() => setDamaged(true)}
                >
                  {condition.isPending
                    ? "…"
                    : (condition.data?.[0]?.damaged ?? 0)}{" "}
                  damaged · View history
                </button>
                <button
                  type="button"
                  className="stock-count-link"
                  title="Units temporarily held by customers for testing. View movement history."
                  onClick={() => setTab("History")}
                >
                  {condition.isPending
                    ? "…"
                    : (condition.data?.[0]?.outForTest ?? 0)}{" "}
                  out for test
                </button>
              </div>
              {condition.isError && (
                <p role="alert">
                  Stock condition could not be loaded.{" "}
                  <button onClick={() => void condition.refetch()}>
                    Retry
                  </button>
                </p>
              )}
              <div className="product-detail-locations">
                {q.data?.balances
                  .filter((b) => b.quantity > 0)
                  .map((b) => (
                    <Link key={b.id} to={"/locations/" + b.locationId}>
                      {locationPath(q.data?.locations ?? [], b.locationId)} ·{" "}
                      {b.quantity} units
                    </Link>
                  ))}
                {!q.data?.balances.some((b) => b.quantity > 0) && (
                  <span>No storage balance assigned yet</span>
                )}
              </div>
              {p.description && (
                <div
                  className="description-content"
                  dangerouslySetInnerHTML={{
                    __html: cleanDescription(p.description),
                  }}
                />
              )}
              {q.data?.cost !== null && q.data?.cost !== undefined && (
                <details className="receiving-review">
                  <summary>Authorized pricing</summary>
                  <p>Purchase cost: {currency(q.data.cost)}</p>
                  {profit && (
                    <p>
                      Estimated margin per unit:{" "}
                      {currency(p.sellingPrice - q.data.cost)}
                    </p>
                  )}
                </details>
              )}
            </div>
          </section>
        ) : tab === "Stock & Locations" ? (
          <>
            <div className="product-detail-keyline">
              <StockAvailability
                id={id}
                quantity={q.data?.stock?.quantity ?? 0}
                minimum={p.lowStockLevel}
              />
              <button
                className="stock-count-link"
                onClick={() => setDamaged(true)}
              >
                {condition.data?.[0]?.damaged ?? 0} damaged · View history
              </button>
              <span>{condition.data?.[0]?.outForTest ?? 0} out for test</span>
            </div>
            <p className="text-muted">
              Total tracked units include sellable, quarantined and out-for-test
              units once. Out-for-test units are outside the shop.
            </p>
            <DataTable
              rows={q.data?.balances ?? []}
              columns={[
                {
                  label: "Location",
                  render: (b) => (
                    <Link to={"/locations/" + b.locationId}>
                      {locationPath(q.data?.locations ?? [], b.locationId)}
                    </Link>
                  ),
                },
                { label: "Quantity", render: (b) => b.quantity },
              ]}
            />
          </>
        ) : tab === "History" ? (
          <>
            <DataTable
              rows={q.data?.movements ?? []}
              columns={[
                {
                  label: "Type",
                  render: (m) => <StatusBadge status={m.type} />,
                },
                { label: "Quantity", render: (m) => m.quantity },
                { label: "Reference", render: (m) => m.reference },
                { label: "Date", render: (m) => stamp(m.createdAt) },
              ]}
            />
            {localDemoEnabled && (
              <>
                <h2 className="section-title mt-6">Sales history</h2>
                <DataTable
                  rows={q.data?.sales ?? []}
                  columns={[
                    {
                      label: "Invoice",
                      render: (s) => (
                        <Link to={"/transactions/" + s.id}>{s.invoice}</Link>
                      ),
                    },
                    { label: "Date", render: (s) => stamp(s.createdAt) },
                    { label: "Total", render: (s) => currency(s.total) },
                  ]}
                />
              </>
            )}
            <h2 className="section-title mt-6">Activity</h2>
            <DataTable
              rows={
                q.data?.audit.filter(
                  (e) => e.reference === id || e.reference === p.internalCode,
                ) ?? []
              }
              columns={[
                { label: "Action", render: (e) => e.description },
                { label: "Recorded by", render: (e) => e.employeeName },
                { label: "Date", render: (e) => stamp(e.createdAt) },
              ]}
            />
          </>
        ) : null}
      </QueryState>
      <Dialog
        open={damaged}
        onOpenChange={setDamaged}
        title="Damaged Inventory"
        description="Quarantined stock and its condition history."
      >
        <DamagedInventory productId={id} />
      </Dialog>
      <ConfirmDialog
        open={archive}
        onClose={() => setArchive(false)}
        title="Archive product?"
        description="The product stays in historical transactions and will no longer appear in New Sale."
        busy={a.busy}
        onConfirm={() =>
          void a.run(
            () => r.products.archive(id),
            "Product archived",
            () => setArchive(false),
          )
        }
      />
    </>
  );
}
