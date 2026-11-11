import { Field } from "../../components/ui/workspace";
import { AppSelect } from "../../components/ui/app-select";
import { SearchableCombobox } from "../../components/ui/searchable-combobox";
import { locationPath, physicalProduct } from "./inventory-controls";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { usePermission } from "../../hooks/use-permission";
import { useAction } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import type { PosProduct } from "../../types/product";
import type { Location, Balance } from "../../types/demo";
export function StockAdjustment({
  products,
  locations,
  balances,
}: {
  products: PosProduct[];
  locations: Location[];
  balances: Balance[];
}) {
  const [open, setOpen] = useState(false);
  const a = useAction();
  const [product, setProduct] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("Physical Count");
  const current =
    balances.find((b) => b.productId === product && b.locationId === location)
      ?.quantity ?? 0;
  const allow = usePermission("inventory.adjust");
  if (!allow) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>Adjust Stock</Button>
      {open && (
        <Dialog
          open
          onOpenChange={setOpen}
          title="Adjust Stock"
          description="Set a counted quantity. The server checks the current balance before recording the difference."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(
                () =>
                  repositories.inventory.adjust(
                    product,
                    location,
                    current,
                    quantity,
                    reason,
                  ),
                "Stock adjusted",
                () => setOpen(false),
              );
            }}
          >
            <div className="form-grid">
              <Field label="Product">
                <SearchableCombobox
                  label="Product"
                  required
                  value={product}
                  onChange={setProduct}
                  options={products
                    .filter(physicalProduct)
                    .map((p) => ({
                      value: p.id,
                      label: p.name,
                      description: p.internalCode,
                    }))}
                />
              </Field>
              <Field label="Box">
                <SearchableCombobox
                  label="Box"
                  required
                  value={location}
                  onChange={setLocation}
                  options={locations
                    .filter(
                      (l) =>
                        l.kind === "box" &&
                        !l.archived &&
                        (l.stockCondition ?? "Available") === "Available",
                    )
                    .map((l) => ({
                      value: l.id,
                      label: locationPath(locations, l.id),
                      description: l.code,
                    }))}
                />
              </Field>
              <label className="form-field">
                Current quantity
                <input readOnly className="input" value={current} />
              </label>
              <label className="form-field">
                New quantity
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>
              <Field label="Reason">
                <AppSelect
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {[
                    "Opening Stock",
                    "Physical Count",
                    "Damaged",
                    "Missing",
                    "Correction",
                    "Other",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </AppSelect>
              </Field>
              <p className="form-field">
                Adjustment amount
                <strong>
                  {quantity - current > 0 ? "+" : ""}
                  {quantity - current}
                </strong>
              </p>
            </div>
            <Button
              className="mt-4"
              type="submit"
              variant="primary"
              disabled={a.busy || !product || !location || quantity === current}
            >
              Record Adjustment
            </Button>
          </form>
          {a.error && (
            <p role="alert" className="text-danger">
              {a.error}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
