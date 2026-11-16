import { useRef, useState } from "react";
import { Plus, Save } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/workspace";
import { ProductMediaManager } from "../../components/media/product-media-manager";
import { saveGallery } from "../../lib/api/gallery";
import {
  mobileProductService,
  type MobileProductInput,
} from "../../lib/mobile/product-service";
import {
  staffService,
  requireMobileOnline,
} from "../../lib/mobile/staff-service";
import { useAction } from "../../hooks/use-repository";
import type { MediaImage } from "../../types/demo";

export function MobileProductCreate({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(""),
    [price, setPrice] = useState(""),
    [minimum, setMinimum] = useState("");
  const [details, setDetails] = useState({
    category: "Parts",
    brand: "",
    compatible_model: "",
    quality_grade: "Grade A",
    color_variant: "",
    aliases: "",
    notes: "",
  });
  const [images, setImages] = useState<MediaImage[]>([]),
    [preparing, setPreparing] = useState(false),
    [failedPhotos, setFailedPhotos] = useState(0),
    [discard, setDiscard] = useState(false);
  const action = useAction(),
    saving = useRef(false);
  const dirty = !!(
    name ||
    price ||
    minimum ||
    images.length ||
    JSON.stringify(details) !==
      JSON.stringify({
        category: "Parts",
        brand: "",
        compatible_model: "",
        quality_grade: "Grade A",
        color_variant: "",
        aliases: "",
        notes: "",
      })
  );
  const close = () => {
    if (action.busy || preparing) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  if (!staffService.allow("products.create")) return null;
  const message = images.length
    ? `Product and ${images.length} ${images.length === 1 ? "photo" : "photos"} saved`
    : "Product saved";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Add Product"
      className="bottom-sheet"
    >
      <form
        className="staff-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (saving.current || preparing || failedPhotos) return;
          saving.current = true;
          void action
            .run(
              async () => {
                requireMobileOnline();
                if (
                  !/^\d+(?:\.\d{1,2})?$/.test(price) ||
                  (minimum && !/^\d+(?:\.\d{1,2})?$/.test(minimum))
                )
                  throw new Error(
                    "Enter prices with up to two decimal places.",
                  );
                const input: MobileProductInput = {
                  id,
                  name,
                  ...details,
                  aliases: details.aliases
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean),
                  selling_price: Number(price),
                  minimum_selling_price: minimum ? Number(minimum) : 0,
                  low_stock_level: 5,
                  variant: "",
                  unit: "Piece",
                  default_location_id: null,
                };
                if (
                  !name.trim() ||
                  !details.category.trim() ||
                  input.minimum_selling_price > input.selling_price
                )
                  throw new Error(
                    "Enter a name, category and valid minimum price.",
                  );
                const gallery = images.length
                  ? await saveGallery(images, "product", id, true)
                  : [];
                return await mobileProductService.create(
                  input,
                  gallery.map((image) => image.path!),
                );
              },
              message,
              (row) => onCreated(row.id),
            )
            .finally(() => {
              saving.current = false;
            });
        }}
      >
        <fieldset
          disabled={action.busy}
          className="staff-form"
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <p className="staff-cache-label">
            Add details and photos from this phone. Stock is received
            separately.
          </p>
          <Field label="Product Name">
            <input
              className="input"
              required
              maxLength={180}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <div className="form-grid">
            <Field label="Selling price (PKR)">
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field
              label="Minimum selling price (PKR)"
              help="Optional. Leave blank for no minimum price."
            >
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={minimum}
                max={price || undefined}
                onChange={(e) => setMinimum(e.target.value)}
              />
            </Field>
          </div>
          <ProductMediaManager
            images={images}
            onChange={setImages}
            useDeviceCamera
            onBusyChange={setPreparing}
            onIssuesChange={setFailedPhotos}
          />
          {failedPhotos > 0 && (
            <p role="alert" className="text-danger">
              Retry or remove failed photos before saving.
            </p>
          )}
          <details>
            <summary>More product details</summary>
            <div className="staff-form">
              {(
                [
                  ["category", "Category"],
                  ["brand", "Brand"],
                  ["compatible_model", "Compatible model"],
                  ["quality_grade", "Grade"],
                  ["color_variant", "Color"],
                  ["aliases", "Search aliases"],
                ] as const
              ).map(([key, label]) => (
                <Field label={label} key={key}>
                  <input
                    className="input"
                    required={key === "category"}
                    maxLength={key === "aliases" ? 500 : 100}
                    value={details[key]}
                    onChange={(e) =>
                      setDetails((old) => ({ ...old, [key]: e.target.value }))
                    }
                  />
                </Field>
              ))}
              <Field label="Notes">
                <textarea
                  className="input"
                  rows={2}
                  maxLength={2000}
                  value={details.notes}
                  onChange={(e) =>
                    setDetails((old) => ({ ...old, notes: e.target.value }))
                  }
                />
              </Field>
            </div>
          </details>
          {action.error && (
            <p role="alert" className="text-danger">
              {action.error}
            </p>
          )}
          <div className="dialog-actions">
            <Button disabled={action.busy || preparing} onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={action.busy || preparing || failedPhotos > 0}
            >
              <Save size={16} />
              {action.busy ? "Saving…" : "Save Product"}
            </Button>
          </div>
        </fieldset>
      </form>
      <Dialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard this product draft?"
      >
        <p>The product and selected photos have not been saved.</p>
        <div className="dialog-actions">
          <Button onClick={() => setDiscard(false)}>Keep Editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard Draft
          </Button>
        </div>
      </Dialog>
    </Dialog>
  );
}
export function AddProductButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick}>
      <Plus size={18} />
      Add Product
    </Button>
  );
}
