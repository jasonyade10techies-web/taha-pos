import { useState } from "react";
import { Archive, Download } from "lucide-react";
import type { DemoProduct } from "../../types/demo";
import { AppCheckbox } from "../../components/ui/app-checkbox";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { ConfirmDialog } from "../../components/ui/workspace";
import { usePermission } from "../../hooks/use-permission";
import { useAction } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import { exportCsv } from "../../lib/export";
export function ProductBulkActions({
  products,
  selected,
  onSelect,
}: {
  products: DemoProduct[];
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const [archive, setArchive] = useState(false),
    [category, setCategory] = useState(false),
    [name, setName] = useState(""),
    action = useAction(),
    canArchive = usePermission("products.archive"),
    canEdit = usePermission("products.edit");
  if (!selected.length) return null;
  const records = products.filter((product) => selected.includes(product.id));
  return (
    <div className="product-bulk-toolbar">
      <label className="checkbox-field">
        <AppCheckbox
          aria-label="Select all filtered products"
          indeterminate={products.some(product=>selected.includes(product.id))&&!products.every(product=>selected.includes(product.id))}
          checked={
            products.length > 0 &&
            products.every((product) => selected.includes(product.id))
          }
          onChange={(event) =>
            onSelect(
              event.target.checked ? products.map((product) => product.id) : [],
            )
          }
        />
        {selected.length} selected
      </label>
      <Button
        size="small"
        onClick={() =>
          exportCsv(
            "Taha-selected-products.csv",
            records.map((product) => ({
              Code: product.internalCode,
              Name: product.name,
              Category: product.category,
              Brand: product.brand,
              Price: product.sellingPrice,
              Status: product.state,
            })),
          )
        }
      >
        <Download size={15} />
        Export
      </Button>
      {canEdit && (
        <Button size="small" onClick={() => setCategory(true)}>
          Change Category
        </Button>
      )}
      {canArchive && (
        <Button size="small" onClick={() => setArchive(true)}>
          <Archive size={15} />
          Archive
        </Button>
      )}
      <Button size="small" variant="ghost" onClick={() => onSelect([])}>
        Clear Selection
      </Button>
      <ConfirmDialog
        open={archive}
        title={`Archive ${selected.length} products?`}
        description="Archived products are removed from new sales. Stock movements and past invoices are preserved."
        onClose={() => setArchive(false)}
        busy={action.busy}
        onConfirm={() =>
          void action.run(
            async () => {
              for (const id of selected)
                await repositories.products.archive(id);
            },
            "Selected products archived",
            () => {
              setArchive(false);
              onSelect([]);
            },
          )
        }
      />
      <Dialog
        open={category}
        title="Change category"
        onOpenChange={setCategory}
      >
        <label className="form-field">
          Category
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <Button onClick={() => setCategory(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || action.busy}
            variant="primary"
            onClick={() =>
              void action.run(
                async () => {
                  for (const id of selected) {
                    const product = await repositories.products.get(id);
                    if (!product)
                      throw new Error(
                        "A selected product is no longer available.",
                      );
                    await repositories.products.save({
                      ...product,
                      category: name.trim(),
                      initialQuantity: 0,
                    });
                  }
                },
                "Product categories updated",
                () => {
                  setCategory(false);
                  onSelect([]);
                },
              )
            }
          >
            Save Category
          </Button>
        </div>
        {action.error && (
          <p role="alert" className="text-danger">
            {action.error}
          </p>
        )}
      </Dialog>
    </div>
  );
}
