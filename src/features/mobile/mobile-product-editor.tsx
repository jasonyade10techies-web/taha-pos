import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";
import { mobileProductService } from "../../lib/mobile/product-service";
import type { ProductRow } from "../../types/database";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { AppSelect } from "../../components/ui/app-select";
import { DescriptionEditor } from "../../components/ui/description-editor";
import { Field, CurrencyInput } from "../../components/ui/workspace";
import { useAction } from "../../hooks/use-repository";

export function MobileProductEditor({ id }: { id: string }) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<ProductRow | null>(null),
    [discard, setDiscard] = useState(false);
  const action = useAction(),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ["staff-product-editor", id],
    queryFn: () => mobileProductService.get(id),
    enabled: open,
  });
  const value = draft ?? query.data;
  const set = <K extends keyof ProductRow>(key: K, next: ProductRow[K]) => {
    if (value) setDraft({ ...value, [key]: next });
  };
  const close = () => {
    if (draft) setDiscard(true);
    else setOpen(false);
  };
  return (
    <>
      <Button
        onClick={() => {
          setDraft(null);
          setOpen(true);
        }}
      >
        <Pencil size={16} />
        Edit Details
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title="Edit Product"
        className="bottom-sheet"
      >
        {query.isPending ? (
          <p role="status">Loading product…</p>
        ) : query.isError ? (
          <p role="alert">{query.error.message}</p>
        ) : (
          value && (
            <form
              className="staff-form"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  await mobileProductService.save(value);
                  await client.invalidateQueries({
                    queryKey: ["staff-products"],
                  });
                  await client.invalidateQueries({
                    queryKey: ["staff-product-editor", id],
                  });
                  setDraft(null);
                  setOpen(false);
                }, "Product saved");
              }}
            >
              <p className="staff-cache-label">
                {value.internal_code} · Changes are saved to the shop. Receive
                or transfer stock separately.
              </p>
              <Field label="Product Name">
                <input
                  className="input"
                  required
                  maxLength={180}
                  value={value.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <DescriptionEditor
                value={value.description_html ?? ""}
                onChange={(html) => set("description_html", html)}
              />
              <div className="form-grid">
                <Field label="Selling price (PKR)">
                  <CurrencyInput
                    value={value.selling_price}
                    required
                    min={0}
                    onChange={(e) =>
                      set("selling_price", Number(e.target.value))
                    }
                  />
                </Field>
                <Field
                  label="Minimum selling price (PKR)"
                  help="Lowest price an employee may use without manager approval."
                >
                  <CurrencyInput
                    value={value.minimum_selling_price}
                    required
                    min={0}
                    max={value.selling_price}
                    onChange={(e) =>
                      set("minimum_selling_price", Number(e.target.value))
                    }
                  />
                </Field>
              </div>
              {(
                [
                  ["category", "Category"],
                  ["brand", "Brand"],
                  ["compatible_model", "Compatible model"],
                  ["quality_grade", "Grade"],
                  ["color_variant", "Color"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    className="input"
                    maxLength={100}
                    value={value[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </Field>
              ))}
              <Field label="Search aliases">
                <input
                  className="input"
                  defaultValue={value.aliases.join(", ")}
                  onChange={(e) =>
                    set(
                      "aliases",
                      e.target.value
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </Field>
              <Field label="Low stock level">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={value.low_stock_level}
                  onChange={(e) =>
                    set("low_stock_level", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Status">
                <AppSelect
                  value={value.state}
                  onChange={(e) =>
                    set("state", e.target.value as ProductRow["state"])
                  }
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </AppSelect>
              </Field>
              <Field label="Notes">
                <textarea
                  className="input"
                  rows={3}
                  maxLength={2000}
                  value={value.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
              {action.error && (
                <p role="alert" className="text-danger">
                  {action.error}
                </p>
              )}
              <div className="dialog-actions">
                <Button disabled={action.busy} onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={action.busy || !draft}
                >
                  <Save size={16} />
                  {action.busy ? "Saving…" : "Save Product"}
                </Button>
              </div>
            </form>
          )
        )}
        <Dialog
          open={discard}
          onOpenChange={setDiscard}
          title="Discard unsaved changes?"
        >
          <div className="dialog-actions">
            <Button onClick={() => setDiscard(false)}>Keep Editing</Button>
            <Button
              variant="primary"
              onClick={() => {
                setDiscard(false);
                setDraft(null);
                setOpen(false);
              }}
            >
              Discard Changes
            </Button>
          </div>
        </Dialog>
      </Dialog>
    </>
  );
}
