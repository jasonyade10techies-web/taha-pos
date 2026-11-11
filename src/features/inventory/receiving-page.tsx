import { useRef,useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { usePermission } from "../../hooks/use-permission";
import {
  PageHeader,
  QueryState,
  DataTable,
  StatusBadge,
} from "../../components/ui/workspace";
import { SearchableCombobox } from "../../components/ui/searchable-combobox";
import { DatePicker } from "../../components/ui/date-picker";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { ProductThumbnail } from "../../components/ui/product-thumbnail";
import { AppSelect } from "../../components/ui/app-select";
import { currency } from "../../lib/utils";
import type { ReceiveDraft, ReceiveLine, ProductInput } from "../../types/demo";
import {
  SupplierCombobox,
  locationPath,
  physicalProduct,
} from "./inventory-controls";
import { ProductEditor } from "./product-editor";

const shopToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const emptyLine = (locationId = ""): ReceiveLine => ({
  productId: "",
  quantity: 1,
  cost: undefined,
  locationId,
  condition: "Available",
});
export function ReceivingPage() {
  const quickProductTrigger=useRef<HTMLElement|null>(null);
  const [params] = useSearchParams(),
    canCost = usePermission("costs.view_purchase_cost"),
    canCreate = usePermission("products.create"),
    canReceive = usePermission("inventory.receive");
  const q = useRepository("receiving", async () => {
      const [products, stock, locations, suppliers, drafts, settings] =
        await Promise.all([
          r.products.list(),
          r.products.pos(),
          r.locations.list(),
          r.suppliers.list(),
          r.inventory.drafts(),
          r.settings.get(),
        ]);
      return { products, stock, locations, suppliers, drafts, settings };
    }),
    a = useAction();
  const [id, setId] = useState(() => crypto.randomUUID()),
    [supplier, setSupplier] = useState(""),
    [reference, setReference] = useState(""),
    [date, setDate] = useState(shopToday),
    [lines, setLines] = useState<ReceiveLine[]>([
      {
        ...emptyLine(params.get("location") ?? ""),
        productId: params.get("product") ?? "",
        quantity: Number(params.get("quantity")) || 1,
      },
    ]),
    [quickProduct, setQuickProduct] = useState<{
      row: number;
      name: string;
    } | null>(null),
    [review, setReview] = useState(false);
  const update = (index: number, patch: Partial<ReceiveLine>) =>
    setLines((old) =>
      old.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  const draft = (): ReceiveDraft => ({
    id,
    supplierId: supplier,
    reference: reference.trim(),
    date,
    lines,
    status: "Draft",
    createdAt: new Date().toISOString(),
  });
  const products = (q.data?.products ?? []).filter(
    (p) => p.state === "active" && physicalProduct(p),
  );
  const validation = () => {
    if (!supplier) return "Select a supplier or add one before receiving.";
    if (!date) return "Choose a received date.";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i],
        product = products.find((p) => p.id === line.productId),
        location = q.data?.locations.find((l) => l.id === line.locationId);
      if (!product)
        return `Row ${i + 1}: choose an active physical product. Phones use per-device intake.`;
      if (!Number.isInteger(line.quantity) || line.quantity <= 0)
        return `Row ${i + 1}: quantity must be a positive whole number.`;
      if (
        !location ||
        location.archived ||
        location.kind !== "box" ||
        (location.stockCondition ?? "Available") !==
          (line.condition ?? "Available")
      )
        return `Row ${i + 1}: select a destination matching the stock condition.`;
      if (
        line.cost !== undefined &&
        (!Number.isFinite(line.cost) || line.cost < 0)
      )
        return `Row ${i + 1}: purchase cost must be zero or greater, or blank for unknown.`;
    }
    return "";
  };
  const [reviewError, setReviewError] = useState("");
  const total = lines.reduce(
      (sum, line) => sum + line.quantity * (line.cost ?? 0),
      0,
    ),
    unknown = lines.filter((line) => line.cost === undefined).length;
  const freshProduct: ProductInput = {
    name: quickProduct?.name ?? "",
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
    unit: q.data?.settings.defaultUnit ?? "piece",
    notes: "",
    image: "",
    state: "active",
    initialQuantity: 0,
    purchaseCost: undefined,
    supplierId: supplier,
  };
  return (
    <>
      <PageHeader
        title="Stock Receiving"
        subtitle="Add newly received items to the selected storage location."
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <section className="panel form-section">
          <div className="form-grid">
            <div className="form-field">
              <span>Supplier</span>
              <SupplierCombobox value={supplier} onChange={setSupplier} />
            </div>
            <label className="form-field">
              Reference
              <input
                className="input"
                aria-label="Reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Supplier invoice / delivery reference"
              />
            </label>
            <div className="form-field">
              <span>Received date</span>
              <DatePicker
                value={date}
                onChange={setDate}
                label="Received date"
              />
            </div>
          </div>
          <p className="text-muted">
            Service-only records are excluded.{" "}
            <Link className="text-link" to="/used-phones">
              Individually tracked phones use per-device intake.
            </Link>
          </p>
          <div className="receive-lines">
            {lines.map((line, index) => (
              <div className="receive-line-v2" key={index}>
                <label>
                  Product
                  <SearchableCombobox
                    label={`Product ${index + 1}`}
                    value={line.productId}
                    onChange={(productId) => update(index, { productId })}
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.name,
                      description: [
                        p.compatibleModel,
                        p.qualityGrade,
                        p.color,
                        p.internalCode,
                        `${q.data?.stock.find((s) => s.id === p.id)?.quantity ?? 0} available`,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      image: <ProductThumbnail product={p} small />,
                    }))}
                    createLabel="Add Product"
                    onCreate={
                      canCreate
                        ? (name) => {quickProductTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setQuickProduct({ row: index, name });}
                        : undefined
                    }
                  />
                </label>
                <label>
                  Quantity
                  <input
                    aria-label={`Quantity ${index + 1}`}
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(e) =>
                      update(index, { quantity: Number(e.target.value) })
                    }
                  />
                </label>
                {canCost && (
                  <label>
                    Purchase cost
                    <input
                      aria-label={`Purchase cost ${index + 1}`}
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unknown"
                      value={line.cost ?? ""}
                      onChange={(e) =>
                        update(index, {
                          cost:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                    <small className="cell-secondary">
                      {line.cost === undefined
                        ? "Unknown cost · 0 means free"
                        : `Line total: ${currency(line.quantity * line.cost)}`}
                    </small>
                  </label>
                )}
                <label>
                  Condition
                  <AppSelect
                    aria-label={`Condition ${index + 1}`}
                    value={line.condition ?? "Available"}
                    onChange={(e) =>
                      update(index, {
                        condition:
                          e.target.value === "Damaged"
                            ? "Damaged"
                            : "Available",
                        locationId: "",
                      })
                    }
                  >
                    <option value="Available">Sellable</option>
                    <option value="Damaged">Damaged / Quarantine</option>
                  </AppSelect>
                </label>
                <label>
                  Destination
                  <SearchableCombobox
                    label={`Destination ${index + 1}`}
                    value={line.locationId}
                    onChange={(locationId) => update(index, { locationId })}
                    options={(q.data?.locations ?? [])
                      .filter(
                        (l) =>
                          l.kind === "box" &&
                          !l.archived &&
                          (l.stockCondition ?? "Available") ===
                            (line.condition ?? "Available"),
                      )
                      .map((l) => ({
                        value: l.id,
                        label: locationPath(q.data?.locations ?? [], l.id),
                        description: `${l.code} · ${l.stockCondition === "Damaged" ? "Damaged / Quarantine" : "Sellable"}`,
                      }))}
                  />
                </label>
                <Button
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((old) => old.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <Button onClick={() => setLines((old) => [...old, emptyLine()])}>
            Add Row
          </Button>
          <div className="receiving-review">
            <strong>
              {lines.reduce((sum, line) => sum + line.quantity, 0)} units in{" "}
              {lines.length} row{lines.length === 1 ? "" : "s"}
            </strong>
            {canCost && (
              <p>
                Known purchase total: {currency(total)}
                {unknown
                  ? ` · ${unknown} row${unknown === 1 ? " has" : "s have"} unknown cost; not included in this total.`
                  : ""}
              </p>
            )}
            <p>
              Saving a draft does not add stock. Catalogue-only product creation
              also adds no stock.
            </p>
          </div>
          {(a.error || reviewError) && (
            <p className="text-danger" role="alert">
              {a.error || reviewError}
            </p>
          )}
          <div className="form-actions">
            <Button
              disabled={a.busy || !canReceive}
              onClick={() =>
                void a.run(() => r.inventory.saveDraft(draft()), "Draft saved")
              }
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              disabled={a.busy || !canReceive}
              onClick={() => {
                const error = validation();
                setReviewError(error);
                if (!error) setReview(true);
              }}
            >
              Receive Stock
            </Button>
          </div>
        </section>
        <h2 className="section-title mt-6">Receiving history & drafts</h2>
        <DataTable
          rows={q.data?.drafts ?? []}
          columns={[
            {
              label: "Reference",
              render: (d) => d.reference || d.id.slice(0, 8),
            },
            {
              label: "Supplier",
              render: (d) =>
                q.data?.suppliers.find((s) => s.id === d.supplierId)?.name ??
                "—",
            },
            {
              label: "Units",
              render: (d) =>
                d.lines.reduce((sum, line) => sum + line.quantity, 0),
            },
            {
              label: "Status",
              render: (d) => <StatusBadge status={d.status} />,
            },
            {
              label: "Action",
              render: (d) =>
                d.status === "Draft" ? (
                  <Button
                    size="small"
                    onClick={() => {
                      setId(d.id as ReturnType<typeof crypto.randomUUID>);
                      setSupplier(d.supplierId);
                      setReference(d.reference);
                      setDate(d.date);
                      setLines(d.lines);
                      setReviewError("");
                    }}
                  >
                    Continue Draft
                  </Button>
                ) : (
                  "Recorded"
                ),
            },
          ]}
        />
      </QueryState>
      <Dialog
        open={review}
        onOpenChange={setReview}
        title="Review Stock Receiving"
        description="Confirm product, quantity, stock condition and destination before posting stock."
      >
        <div className="receiving-review">
          {lines.map((line, index) => (
            <p key={index}>
              <strong>
                {line.quantity} ×{" "}
                {products.find((p) => p.id === line.productId)?.name}
              </strong>
              <br />
              {line.condition === "Damaged"
                ? "Damaged / Quarantine"
                : "Sellable"}{" "}
              → {locationPath(q.data?.locations ?? [], line.locationId)}
              {canCost && (
                <>
                  <br />
                  {line.cost === undefined
                    ? "Purchase cost unknown"
                    : `Unit cost: ${currency(line.cost)}`}
                </>
              )}
            </p>
          ))}
        </div>
        {a.error && (
          <p role="alert" className="text-danger">
            {a.error}
          </p>
        )}
        <div className="form-actions">
          <Button onClick={() => setReview(false)}>Back to draft</Button>
          <Button
            variant="primary"
            disabled={a.busy}
            onClick={() =>
              void a.run(
                async () => {
                  const error = validation();
                  if (error) throw new Error(error);
                  await r.inventory.receive(draft());
                },
                "Stock received",
                () => {
                  setReview(false);
                  setId(crypto.randomUUID());
                  setLines([emptyLine()]);
                  setReference("");
                  setReviewError("");
                },
              )
            }
          >
            Confirm Receive Stock
          </Button>
        </div>
      </Dialog>
      {quickProduct && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setQuickProduct(null);
          }}
          title="Add Product for Receiving"
          onCloseAutoFocus={()=>quickProductTrigger.current?.focus()}
          description="Create the catalogue record. This draft will add stock once at final receiving."
          className="receiving-product-dialog"
        >
          <ProductEditor
            initial={freshProduct}
            locations={q.data?.locations ?? []}
            admin={canCost}
            catalogueOnly
            onCancel={() => setQuickProduct(null)}
            onSaved={(product) => {
              update(quickProduct.row, { productId: product.id });
              setQuickProduct(null);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
