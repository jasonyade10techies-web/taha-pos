import { useRef,useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Package } from "lucide-react";
import { SearchableCombobox } from "../../components/ui/searchable-combobox";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { MediaImage } from "../../components/media/media-image";
import { InfoTooltip } from "../../components/ui/info-tooltip";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { usePermission } from "../../hooks/use-permission";
import type { DemoProduct, Location, Supplier } from "../../types/demo";
import "./phase5d1-inventory.css";

// eslint-disable-next-line react-refresh/only-export-components
export function locationPath(locations: Location[], id: string) {
  const parts: string[] = [],
    seen = new Set<string>();
  let current = locations.find((l) => l.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = locations.find((l) => l.id === current!.parentId);
  }
  return parts.join(" → ") || "No storage balance assigned yet";
}
// eslint-disable-next-line react-refresh/only-export-components
export const physicalProduct = (p: { category: string }) =>
  !["services", "service", "phones", "used phones"].includes(
    p.category.trim().toLocaleLowerCase(),
  );

export function MasterCombobox({
  kind,
  label,
  value,
  onChange,
  required = false,
}: {
  kind: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const q = useRepository("product-values", () => r.products.values()),
    create = usePermission("products.create");
  const defaults: Record<string, string[]> = {
    category: ["Parts", "Accessories", "Phones", "Services"],
    grade: ["Original", "OEM", "Grade A", "Grade B", "OLED", "Copy", "Used"],
  };
  const values = [
    ...new Map(
      [
        ...(defaults[kind] ?? []),
        ...(q.data ?? [])
          .filter((row) => row.kind === kind)
          .map((row) => row.value),
        ...(value ? [value] : []),
      ].map((v) => [v.trim().toLocaleLowerCase(), v]),
    ).values(),
  ];
  return (
    <SearchableCombobox
      label={label}
      value={value}
      required={required}
      onChange={onChange}
      options={values.map((v) => ({ value: v, label: v }))}
      loading={q.isPending}
      error={q.isError ? "Unable to load saved values." : undefined}
      onRetry={() => void q.refetch()}
      onCreate={
        create
          ? async (query) => {
              const saved = await r.products.saveValue(kind, query.trim());
              await q.refetch();
              onChange(saved.value);
            }
          : undefined
      }
    />
  );
}

export function SupplierCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const trigger=useRef<HTMLElement|null>(null);
  const q = useRepository("product-suppliers", () => r.suppliers.list()),
    a = useAction(),
    canCreate = usePermission("inventory.receive");
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [whatsapp, setWhatsapp] = useState(""),
    [address, setAddress] = useState("");
  const save = () =>
    void a.run(
      async () => {
        const canonical = name.trim();
        if (!canonical) throw new Error("Supplier name is required.");
        const duplicate = (await r.suppliers.list()).find(
          (s) =>
            s.name.trim().toLocaleLowerCase() === canonical.toLocaleLowerCase(),
        );
        if (duplicate) return duplicate;
        const record: Supplier = {
          id: crypto.randomUUID(),
          name: canonical,
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          address: address.trim(),
          notes: "",
        };
        return r.suppliers.save(record);
      },
      "Supplier saved",
      (supplier) => {
        onChange(supplier.id);
        setOpen(false);
      },
    );
  return (
    <>
      <SearchableCombobox
        value={value}
        label="Supplier"
        placeholder="Search suppliers…"
        onChange={onChange}
        options={(q.data ?? []).map((s) => ({
          value: s.id,
          label: s.name,
          description: s.phone,
        }))}
        loading={q.isPending}
        error={q.isError ? "Unable to load suppliers." : undefined}
        onRetry={() => void q.refetch()}
        createLabel="Add Supplier"
        onCreate={
          canCreate
            ? (query) => {
                  trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
                setName(query);
                setPhone("");
                setWhatsapp("");
                setAddress("");
                setOpen(true);
              }
            : undefined
        }
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add Supplier"
        onCloseAutoFocus={()=>trigger.current?.focus()}
        description="Save and return to your current draft."
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="form-field">
            Supplier name
            <input
              className="input"
              aria-label="Supplier name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="form-field">
            Phone
            <input
              className="input"
              aria-label="Supplier phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="form-field">
            WhatsApp
            <input
              className="input"
              aria-label="Supplier WhatsApp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </label>
          <label className="form-field">
            Address
            <input
              className="input"
              aria-label="Supplier address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          {a.error && (
            <p role="alert" className="text-danger">
              {a.error}
            </p>
          )}
          <div className="form-actions">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={a.busy}>
              Save Supplier
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function StockAvailability({
  id,
  quantity,
  minimum,
  archived = false,
  onClick,
}: {
  id: string;
  quantity: number;
  minimum: number;
  archived?: boolean;
  onClick?: () => void;
}) {
  const warning = !archived && quantity <= minimum,
    status = archived
      ? "Archived"
      : quantity === 0
        ? "Out of stock"
        : warning
          ? "Low stock"
          : "In stock";
  const contents = (
    <>
      {warning && <AlertTriangle size={13} aria-hidden="true" />}
      <strong>{quantity} available</strong>
      <span>· {status}</span>
    </>
  );
  const props = {
    className: `stock-availability ${warning ? "stock-warning" : ""}`,
    title: `${quantity} units currently available to sell. Select to inspect stock and movement history.`,
  };
  return onClick ? (
    <button type="button" {...props} onClick={onClick}>
      {contents}
    </button>
  ) : (
    <Link {...props} to={`/products/${id}?view=stock`}>
      {contents}
    </Link>
  );
}

export function ProductGalleryPreview({ product }: { product: DemoProduct }) {
  const images = product.gallery?.length
    ? product.gallery
    : product.image || product.imagePath
      ? [{ url: product.image, path: product.imagePath }]
      : [];
  const [index, setIndex] = useState(0),
    [failed, setFailed] = useState<string[]>([]);
  const image = images[index]?.url;
  return (
    <div className="product-detail-gallery">
      <div className="product-detail-image">
        {image && !failed.includes(image) ? (
          <MediaImage
            key={image}
            src={image}
            alt={product.name}
            onError={() => setFailed((old) => [...old, image])}
          />
        ) : (
          <div className="product-media-fallback" role="status">
            <Package size={42} />
            <strong>
              {image || images[index]?.path
                ? "Image unavailable"
                : "No product image"}
            </strong>
            <small>
              {image || images[index]?.path
                ? "Private image could not be loaded. Check the connection or replace it in Edit Product."
                : "Add a photo in Edit Product."}
            </small>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="product-detail-thumbs">
          {images.map((item, i) => (
            <button
              type="button"
              key={item.path ?? item.url ?? i}
              aria-label={`Show product image ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              {failed.includes(item.url) ? (
                <Package size={20} />
              ) : (
                <MediaImage
                  src={item.url}
                  alt={`Product image ${i + 1}`}
                  onError={() => setFailed((old) => [...old, item.url])}
                />
              )}
            </button>
          ))}
        </div>
      )}
      <InfoTooltip label="Product photos remain private. An unavailable photo does not change stock or product details." />
    </div>
  );
}
