import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  QueryState,
  RecordForm,
  DataTable,
  StatusBadge,
  ConfirmDialog,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import type { Location } from "../../types/demo";
import { localDemoEnabled } from "../../lib/config";
import { useShopConfiguration } from "../../hooks/use-shop-configuration";
import { locationPath } from "./inventory-controls";

export function LocationsPage() {
  const { configuration } = useShopConfiguration();
  const labels = configuration.storageLabels;
  const q = useRepository("locations", async () => ({
    locations: await r.locations.list(),
    balances: await r.locations.balances(),
  }));
  const a = useAction();
  const [selectedRack, setRack] = useState(localDemoEnabled ? "rack-12" : "");
  const [selectedShelf, setShelf] = useState(
    localDemoEnabled ? "shelf-12-B" : "",
  );
  const [edit, setEdit] = useState<Location | null>(null);
  const [archive, setArchive] = useState("");
  const rows = q.data?.locations.filter((l) => !l.archived) ?? [];
  const rack =
    rows.find((l) => l.id === selectedRack)?.id ??
    rows.find((l) => l.kind === "rack")?.id ??
    "";
  const shelf =
    rows.find((l) => l.id === selectedShelf && l.parentId === rack)?.id ??
    rows.find((l) => l.parentId === rack && l.kind === "shelf")?.id ??
    "";
  const stock = (id: string): number => {
    const children = rows.filter((l) => l.parentId === id);
    return children.length
      ? children.reduce((s, c) => s + stock(c.id), 0)
      : (q.data?.balances
          .filter((b) => b.locationId === id)
          .reduce((s, b) => s + b.quantity, 0) ?? 0);
  };
  const productCount = (id: string): number => {
    const descendants = new Set([id]);
    for (let i = 0; i < 3; i++)
      rows
        .filter((l) => descendants.has(l.parentId))
        .forEach((l) => descendants.add(l.id));
    return new Set(
      q.data?.balances
        .filter((b) => descendants.has(b.locationId) && b.quantity > 0)
        .map((b) => b.productId),
    ).size;
  };
  const add = (kind: Location["kind"], parentId = "") =>
    setEdit({
      id: crypto.randomUUID(),
      code: "",
      name: "",
      kind,
      parentId,
      archived: false,
    });
  return (
    <>
      <PageHeader
        title="Locations"
        subtitle={`Permanent codes. Flexible names. ${labels.rack} → ${labels.shelf} → ${labels.box}.`}
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <div className="location-columns">
          {(["rack", "shelf", "box"] as const).map((kind) => (
            <section className="panel" key={kind}>
              <div className="panel-heading">
                <div>
                  <h2>{labels[kind]}</h2>
                  <small className="text-muted">
                    {kind === "shelf"
                      ? `Within ${locationPath(rows, rack)}`
                      : kind === "box"
                        ? `Within ${locationPath(rows, shelf)}`
                        : "Main Branch"}
                  </small>
                </div>
                <Button
                  size="small"
                  disabled={
                    kind === "shelf" ? !rack : kind === "box" ? !shelf : false
                  }
                  onClick={() =>
                    add(
                      kind,
                      kind === "shelf" ? rack : kind === "box" ? shelf : "",
                    )
                  }
                >
                  Add
                </Button>
              </div>
              {kind !== "rack" && (
                <span className="location-path-heading">
                  {kind === "shelf"
                    ? rack
                      ? `Selected ${labels.rack.toLocaleLowerCase()}: ${locationPath(rows, rack)}`
                      : `Select a ${labels.rack.toLocaleLowerCase()} first`
                    : shelf
                      ? `Selected path: ${locationPath(rows, shelf)}`
                      : `Select a ${labels.shelf.toLocaleLowerCase()} first`}
                </span>
              )}
              <div className="location-list">
                {!rows.some(
                  (l) =>
                    l.kind === kind &&
                    (kind === "rack" ||
                      l.parentId === (kind === "shelf" ? rack : shelf)),
                ) && (
                  <p className="location-empty-selection">
                    {kind === "rack"
                      ? `No ${labels.rack.toLocaleLowerCase()} locations yet. Add one to begin.`
                      : kind === "shelf" && !rack
                        ? `Choose a ${labels.rack.toLocaleLowerCase()} to see its locations.`
                        : kind === "box" && !shelf
                          ? `Choose a ${labels.shelf.toLocaleLowerCase()} to see its locations.`
                          : `No ${labels[kind].toLocaleLowerCase()} locations within this selection.`}
                  </p>
                )}
                {rows
                  .filter(
                    (l) =>
                      l.kind === kind &&
                      (kind === "rack" ||
                        l.parentId === (kind === "shelf" ? rack : shelf)),
                  )
                  .map((l) => (
                    <article
                      key={l.id}
                      className={
                        l.id === rack || l.id === shelf ? "selected" : ""
                      }
                    >
                      <button
                        className="location-select"
                        aria-pressed={l.id === rack || l.id === shelf}
                        onClick={() => {
                          if (kind === "rack") {
                            setRack(l.id);
                            setShelf(
                              rows.find((s) => s.parentId === l.id)?.id ?? "",
                            );
                          } else if (kind === "shelf") setShelf(l.id);
                        }}
                      >
                        <strong>{l.name}</strong>
                        {l.stockCondition === "Damaged" && (
                          <StatusBadge status="Damaged / Quarantine" />
                        )}
                        <small>
                          {l.code} · {productCount(l.id)} products ·{" "}
                          {stock(l.id)} units
                        </small>
                      </button>
                      <div className="flex gap-2">
                        <Link className="text-link" to={"/locations/" + l.id}>
                          Details
                        </Link>
                        <button
                          className="text-link"
                          onClick={() => setEdit(l)}
                        >
                          Rename
                        </button>
                        <button
                          className="text-link"
                          onClick={() => setArchive(l.id)}
                        >
                          Archive
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </QueryState>
      {edit && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEdit(null);
          }}
          title={edit.code ? "Rename Location" : "Add " + edit.kind}
          description="Internal code is permanent and generated automatically."
        >
          <RecordForm
            fields={[
              { key: "name", label: "Location name", required: true },
              ...(edit.kind === "box"
                ? [
                    {
                      key: "stockCondition",
                      label: "Stock condition",
                      type: "select" as const,
                      required: true,
                      options: [
                        { value: "Available", label: "Available / Sellable" },
                        { value: "Damaged", label: "Damaged / Quarantine" },
                      ],
                    },
                  ]
                : []),
            ]}
            initial={{
              name: edit.name,
              stockCondition: edit.stockCondition ?? "Available",
            }}
            busy={a.busy}
            onSubmit={(v) =>
              void a.run(
                () =>
                  r.locations.save({
                    ...edit,
                    name: String(v.name),
                    stockCondition:
                      v.stockCondition === "Damaged" ? "Damaged" : "Available",
                  }),
                "Location saved",
                () => setEdit(null),
              )
            }
          />
        </Dialog>
      )}
      <ConfirmDialog
        open={!!archive}
        title="Archive empty location?"
        description="Only empty locations without active children or test items can be archived."
        onClose={() => setArchive("")}
        busy={a.busy}
        onConfirm={() =>
          void a.run(
            () => r.locations.archive(archive),
            "Location archived",
            () => setArchive(""),
          )
        }
      />
    </>
  );
}
export function LocationDetailPage() {
  const { id = "" } = useParams();
  const q = useRepository("location-" + id, async () => ({
    location: await r.locations.get(id),
    path: await r.locations.path(id),
    balances: await r.locations.balances(),
    locations: await r.locations.list(),
    products: await r.products.list(),
  }));
  const descendants = new Set([id]);
  for (let i = 0; i < 3; i++)
    q.data?.locations
      .filter((l) => descendants.has(l.parentId))
      .forEach((l) => descendants.add(l.id));
  return (
    <>
      <PageHeader
        title={q.data?.path ?? "Location"}
        subtitle={q.data?.location?.code ?? "Location details"}
        action={
          <>
            <Link className="button button-secondary" to="/transfers">
              Transfer Stock
            </Link>
            <Link className="button button-secondary" to="/locations">
              Rename Location
            </Link>
            <Button onClick={() => window.print()}>Print Label</Button>
          </>
        }
      />
      <div className="print-area label-print">
        <strong>TAHA MOBILES</strong>
        <h2>{q.data?.path}</h2>
        <p>{q.data?.location?.code}</p>
        <div className="qr-placeholder">QR preview</div>
        <div className="barcode-placeholder">Barcode preview</div>
      </div>
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <DataTable
          rows={
            q.data?.balances.filter(
              (b) => descendants.has(b.locationId) && b.quantity > 0,
            ) ?? []
          }
          columns={[
            {
              label: "Product",
              render: (b) => (
                <Link to={"/products/" + b.productId}>
                  {q.data?.products.find((p) => p.id === b.productId)?.name}
                </Link>
              ),
            },
            {
              label: "Box",
              render: (b) => (
                <Link to={"/locations/" + b.locationId}>
                  {locationPath(q.data?.locations ?? [], b.locationId)}
                </Link>
              ),
            },
            { label: "Quantity", render: (b) => b.quantity },
            {
              label: "Status",
              render: () => <StatusBadge status="In Stock" />,
            },
          ]}
        />
      </QueryState>
    </>
  );
}
