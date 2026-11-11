import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, RotateCcw, Sparkles } from "lucide-react";
import {
  FormSection,
  Field,
  CurrencyInput,
  StatusBadge,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { AppSelect } from "../../components/ui/app-select";
import { Dialog } from "../../components/ui/dialog";
import { DescriptionEditor } from "../../components/ui/description-editor";
import { repositories } from "../../lib/repositories";
import { useAction } from "../../hooks/use-repository";
import type {
  ProductInput,
  Location,
  MediaImage,
  DemoProduct,
} from "../../types/demo";
import { localDemoEnabled } from "../../lib/config";
import { CameraCapture } from "../../components/camera/camera-capture";
import { InfoTooltip } from "../../components/ui/info-tooltip";
import { ProductMediaManager } from "../../components/media/product-media-manager";
import { loadImageEdits } from "../../lib/image-edits";
import { suggestAliases } from "../../lib/product-search";
import { saveProductDraft, removeProductDraft } from "../../lib/product-drafts";
import {
  MasterCombobox,
  SupplierCombobox,
  locationPath,
  physicalProduct,
} from "./inventory-controls";
import { SearchableCombobox } from "../../components/ui/searchable-combobox";
import { useShopConfiguration } from "../../hooks/use-shop-configuration";

export function ProductEditor({
  initial,
  locations,
  admin,
  catalogueOnly = false,
  onSaved,
  onCancel,
}: {
  initial: ProductInput;
  locations: Location[];
  admin: boolean;
  catalogueOnly?: boolean;
  onSaved?: (product: DemoProduct) => void;
  onCancel?: () => void;
}) {
  const { configuration } = useShopConfiguration();
  const [value, setValue] = useState(() => {
    loadImageEdits(initial.gallery || []);
    return {
      ...initial,
      description: initial.description ?? "",
      initialCondition: initial.initialCondition ?? "Available",
      gallery: initial.gallery?.length
        ? initial.gallery
        : initial.image
          ? [{ url: initial.image, path: initial.imagePath }]
          : [],
    };
  });
  const draftRequestId = useRef(
    initial.draftRequestId ?? initial.id ?? crypto.randomUUID(),
  );
  const baseline = useRef(JSON.stringify(value)),
    saved = useRef(false),
    [preparing, setPreparing] = useState(false),
    [destination, setDestination] = useState<string | null>(null),
    [pendingDraft, setPendingDraft] = useState(false);
  const action = useAction(),
    navigate = useNavigate();
  const dirty = baseline.current !== JSON.stringify(value),
    busy = action.busy || preparing;
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty && !saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      if (
        !dirty ||
        saved.current ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin) return;
      const next = url.hash.startsWith("#/")
        ? url.hash.slice(1)
        : url.pathname + url.search;
      if (next === location.pathname + location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(next);
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  const change = <K extends keyof ProductInput>(
    key: K,
    next: ProductInput[K],
  ) => {
    setPendingDraft(false);
    setValue((old) => ({ ...old, [key]: next }));
  };
  const gallery = (images: MediaImage[]) =>
    setValue((old) => ({
      ...old,
      gallery: images,
      image: images[0]?.url ?? "",
      imagePath: images[0]?.path,
    }));
  const receive = (url: string, path?: string) =>
    setValue((old) => {
      if (old.gallery.some((image) => image.path && image.path === path))
        return old;
      const images = [...old.gallery, { url, path }].slice(0, 12);
      return {
        ...old,
        gallery: images,
        image: images[0]?.url ?? "",
        imagePath: images[0]?.path,
      };
    });
  const box = locations.find((item) => item.id === value.locationId),
    shelf = locations.find((item) => item.id === box?.parentId);
  const [rackId, setRack] = useState(shelf?.parentId ?? ""),
    [shelfId, setShelf] = useState(shelf?.id ?? "");
  const text = (
    key:
      | "name"
      | "brand"
      | "compatibleModel"
      | "qualityGrade"
      | "color"
      | "variant"
      | "unit",
    required = false,
  ) =>
    ["brand", "compatibleModel", "qualityGrade", "color"].includes(key) ? (
      <MasterCombobox
        kind={
          key === "compatibleModel"
            ? "model"
            : key === "qualityGrade"
              ? "grade"
              : key
        }
        label={
          {
            brand: "Brand",
            compatibleModel: "Compatible model",
            qualityGrade: "Quality grade",
            color: "Color",
          }[key as "brand" | "compatibleModel" | "qualityGrade" | "color"]
        }
        value={value[key]}
        onChange={(next) => change(key, next)}
        required={required}
      />
    ) : (
      <input
        className="input"
        value={value[key]}
        required={required}
        onChange={(event) => change(key, event.target.value)}
      />
    );
  const save = () => {
    if (busy) return;
    void action.run(
      async () => {
        if (
          !value.name.trim() ||
          !value.category.trim() ||
          !value.brand.trim() ||
          !value.qualityGrade.trim() ||
          !value.unit.trim()
        )
          throw new Error(
            "Complete product name, category, brand, quality grade and unit. Select or explicitly create a saved value.",
          );
        if (catalogueOnly && !physicalProduct(value))
          throw new Error(
            "Receiving creates physical parts or accessories. Service records and individually tracked phones use their dedicated workflows.",
          );
        if (!localDemoEnabled && !navigator.onLine) {
          await saveProductDraft({
            ...value,
            draftRequestId: draftRequestId.current,
          });
          return null;
        }
        const product = await repositories.products.save({
          ...value,
          ...(catalogueOnly
            ? { initialQuantity: 0, initialCondition: "Available" as const }
            : {}),
          draftRequestId: draftRequestId.current,
        });
        await removeProductDraft(draftRequestId.current);
        return product;
      },
      !localDemoEnabled && !navigator.onLine
        ? "Product draft queued — Pending Sync"
        : "Product saved",
      (product) => {
        if (product) {
          saved.current = true;
          if (onSaved) onSaved(product);
          else navigate("/products/" + product.id);
        } else {
          baseline.current = JSON.stringify(value);
          setPendingDraft(true);
        }
      },
    );
  };
  const phone = (
    <CameraCapture
      type="product-photo"
      title={value.name.trim() || "Product Photo"}
      entityId={value.id}
      buttonLabel="Use Mobile"
      compact
      multiple
      onImage={(image) => receive(image)}
      onStoredImage={({ preview, path }) => receive(preview, path)}
    />
  );
  return (
    <form
      className="product-editor-v2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <header className="product-editor-header">
        <div>
          <div className="product-editor-title">
            <h1>{initial.id ? initial.name : "Add Product"}</h1>
            {initial.id && (
              <StatusBadge
                status={value.state === "active" ? "Active" : "Archived"}
              />
            )}
          </div>
          <p>Internal product codes are generated automatically.</p>
        </div>
        <div>
          <Button
            disabled={busy}
            onClick={() =>
              onCancel
                ? onCancel()
                : dirty
                  ? setDestination("/products")
                  : navigate("/products")
            }
          >
            <RotateCcw size={16} />
            Discard
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            <Save size={16} />
            {action.busy ? "Saving…" : "Save Product"}
          </Button>
        </div>
      </header>
      {(dirty || pendingDraft) && (
        <div className="product-unsaved-bar" role="status">
          <strong>
            {pendingDraft
              ? "Pending Sync · draft saved on this counter"
              : "Unsaved changes"}
          </strong>
          <span>
            {pendingDraft
              ? "Stock is recorded only after the server accepts the draft."
              : "Save when you are ready."}
          </span>
          <Button
            size="small"
            disabled={busy}
            onClick={() =>
              onCancel ? onCancel() : setDestination("/products")
            }
          >
            Discard
          </Button>
          <Button size="small" type="submit" variant="primary" disabled={busy}>
            {action.busy ? "Saving…" : pendingDraft ? "Retry Sync" : "Save"}
          </Button>
        </div>
      )}
      <div className="product-editor-columns">
        <div className="product-editor-main">
          <FormSection title="Product">
            <Field label="Product Name" wide>
              {text("name", true)}
            </Field>
            <Field label="Description" wide>
              <DescriptionEditor
                value={value.description ?? ""}
                onChange={(html) => change("description", html)}
              />
            </Field>
          </FormSection>
          <section className="panel product-media-card">
            <ProductMediaManager
              images={value.gallery}
              onChange={gallery}
              phoneAction={phone}
              onBusyChange={setPreparing}
            />
          </section>
          <FormSection title="Pricing">
            <Field label="Selling price (PKR)">
              <CurrencyInput
                min="0.01"
                step="0.01"
                required
                value={value.sellingPrice}
                onChange={(event) =>
                  change("sellingPrice", Number(event.target.value))
                }
              />
            </Field>
            <Field label="Minimum selling price (PKR)">
              <InfoTooltip label="Lowest permitted price without an authorized override." />
              <CurrencyInput
                step="0.01"
                max={value.sellingPrice}
                required
                value={value.minimumSellingPrice}
                onChange={(event) =>
                  change("minimumSellingPrice", Number(event.target.value))
                }
              />
            </Field>
            {admin && (
              <Field
                label="Purchase cost (PKR)"
                help="Leave blank to keep the saved cost, or unknown for a new product. Enter 0 only for a free item."
              >
                <InfoTooltip label="What the shop paid. Restricted to authorized accounts." />
                <CurrencyInput
                  step="0.01"
                  value={value.purchaseCost ?? ""}
                  onChange={(event) =>
                    change(
                      "purchaseCost",
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                    )
                  }
                />
              </Field>
            )}
          </FormSection>
          <FormSection
            title="Inventory"
            description={
              catalogueOnly
                ? "Create the catalogue record now. Stock is added once when this receiving draft is completed."
                : initial.id
                  ? "Stock Receiving and Transfers preserve the movement history."
                  : "Opening stock creates a movement after the product is saved."
            }
          >
            {!initial.id && !catalogueOnly && (
              <Field label="Initial stock">
                <InfoTooltip label="How many units you already have when adding this product." />
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={value.initialQuantity}
                  onChange={(event) =>
                    change("initialQuantity", Number(event.target.value))
                  }
                />
              </Field>
            )}
            <Field label="Unit">{text("unit", true)}</Field>
            {!initial.id && !catalogueOnly && (
              <Field label="Initial stock condition">
                <InfoTooltip label="Sellable units are available in POS. Damaged units enter quarantine and cannot be sold." />
                <AppSelect
                  aria-label="Initial stock condition"
                  value={value.initialCondition}
                  onChange={(e) => {
                    change(
                      "initialCondition",
                      e.target.value === "Damaged" ? "Damaged" : "Available",
                    );
                    change("locationId", "");
                  }}
                >
                  <option value="Available">Sellable</option>
                  <option value="Damaged">Damaged / Quarantine</option>
                </AppSelect>
              </Field>
            )}
            <Field label="Low-stock alert at">
              <InfoTooltip label="Warn when available quantity reaches this number or less." />
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={value.lowStockLevel}
                onChange={(event) =>
                  change("lowStockLevel", Number(event.target.value))
                }
              />
            </Field>
          </FormSection>
          <FormSection
            title="Variant"
            description="Describe this stocked variant. Create a separate product for independently tracked stock."
          >
            <Field label="Color">{text("color")}</Field>
            <Field label="Variant">{text("variant")}</Field>
          </FormSection>
          <FormSection
            title="Search aliases"
            description="Add local terms and alternate names customers use."
          >
            <Field label="Aliases / local names (comma separated)" wide>
              <InfoTooltip label="Other names customers use when asking for this item." />
              <input
                className="input"
                value={value.aliases.join(", ")}
                onChange={(event) =>
                  change(
                    "aliases",
                    event.target.value
                      .split(",")
                      .map((alias) => alias.trimStart()),
                  )
                }
              />
              <Button
                size="small"
                disabled={!value.name.trim()}
                onClick={() =>
                  change("aliases", [
                    ...new Set([...value.aliases, ...suggestAliases(value)]),
                  ])
                }
              >
                <Sparkles size={14} />
                Accept Suggested Aliases
              </Button>
              <small>{suggestAliases(value).slice(0, 4).join(" · ")}</small>
            </Field>
          </FormSection>
          <FormSection
            title="Location"
            description={`${configuration.storageLabels.rack} → ${configuration.storageLabels.shelf} → ${configuration.storageLabels.box}`}
          >
            <Field label={configuration.storageLabels.rack}>
              <SearchableCombobox
                label={configuration.storageLabels.rack}
                value={rackId}
                onChange={(next) => {
                  setRack(next);
                  setShelf("");
                  change("locationId", "");
                }}
                options={locations
                  .filter((item) => item.kind === "rack" && !item.archived)
                  .map((item) => ({
                    value: item.id,
                    label: item.name,
                    description: item.code,
                  }))}
              />
            </Field>
            <Field label={configuration.storageLabels.shelf}>
              <SearchableCombobox
                label={configuration.storageLabels.shelf}
                disabled={!rackId}
                value={shelfId}
                onChange={(next) => {
                  setShelf(next);
                  change("locationId", "");
                }}
                options={locations
                  .filter(
                    (item) =>
                      item.kind === "shelf" &&
                      !item.archived &&
                      item.parentId === rackId,
                  )
                  .map((item) => ({
                    value: item.id,
                    label: item.name,
                    description: locationPath(locations, item.id),
                  }))}
              />
            </Field>
            <Field
              label={`Default ${configuration.storageLabels.box.toLocaleLowerCase()}`}
            >
              <SearchableCombobox
                label={`Default ${configuration.storageLabels.box.toLocaleLowerCase()}`}
                required={!catalogueOnly && value.initialQuantity > 0}
                value={value.locationId}
                onChange={(next) => change("locationId", next)}
                options={locations
                  .filter(
                    (item) =>
                      item.kind === "box" &&
                      !item.archived &&
                      (initial.id ||
                        (item.stockCondition ?? "Available") ===
                          value.initialCondition) &&
                      (!shelfId || item.parentId === shelfId),
                  )
                  .map((item) => ({
                    value: item.id,
                    label: locationPath(locations, item.id),
                    description: `${item.code} · ${item.stockCondition === "Damaged" ? "Damaged / Quarantine" : "Sellable"}`,
                  }))}
              />
            </Field>
          </FormSection>
          <FormSection title="Internal notes">
            <Field label="Notes" wide>
              <textarea
                className="input"
                rows={3}
                value={value.notes}
                onChange={(event) => change("notes", event.target.value)}
              />
            </Field>
          </FormSection>
        </div>
        <aside className="product-editor-side">
          <FormSection title="Status">
            <Field label="Product status" wide>
              <AppSelect
                value={value.state}
                onChange={(event) =>
                  change("state", event.target.value as ProductInput["state"])
                }
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </AppSelect>
            </Field>
          </FormSection>
          <FormSection title="Product organization">
            <Field label="Category" wide>
              <MasterCombobox
                kind="category"
                label="Category"
                required
                value={value.category}
                onChange={(next) => change("category", next)}
              />
            </Field>
            <Field label="Brand" wide>
              {text("brand", true)}
            </Field>
            <Field label="Compatible model" wide>
              {text("compatibleModel")}
            </Field>
            <Field label="Quality grade" wide>
              {text("qualityGrade", true)}
            </Field>
            {configuration.enabledFeatures.suppliers && (
              <Field label="Supplier" wide>
                <SupplierCombobox
                  value={value.supplierId ?? ""}
                  onChange={(next) => change("supplierId", next)}
                />
              </Field>
            )}
          </FormSection>
          <FormSection title="Availability">
            <Field label="Visibility" wide>
              <span className="text-muted">
                Store only · Website functionality is disabled.
              </span>
            </Field>
            <Field label="Tags (comma separated)" wide>
              <input
                className="input"
                value={(value.tags ?? []).join(", ")}
                onChange={(event) =>
                  change(
                    "tags",
                    event.target.value.split(",").map((tag) => tag.trimStart()),
                  )
                }
              />
            </Field>
          </FormSection>
        </aside>
      </div>
      {action.error && (
        <p className="text-danger" role="alert">
          {action.error}
        </p>
      )}
      <Dialog
        open={destination !== null}
        title="Discard unsaved changes?"
        description="Your changes have not been saved. Product stock and prices will stay as they were."
        onOpenChange={(open) => {
          if (!open) setDestination(null);
        }}
      >
        <div className="dialog-actions">
          <Button onClick={() => setDestination(null)}>Keep Editing</Button>
          <Button
            variant="primary"
            onClick={() => {
              saved.current = true;
              navigate(destination ?? "/products");
            }}
          >
            Discard Changes
          </Button>
        </div>
      </Dialog>
    </form>
  );
}
