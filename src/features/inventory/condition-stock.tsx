import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { usePermission } from "../../hooks/use-permission";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { AppSelect } from "../../components/ui/app-select";
import {
  DataTable,
  QueryState,
  StatCard,
  Field,
} from "../../components/ui/workspace";
import { MediaUploader } from "../../components/media/media-uploader";
import { CameraCapture } from "../../components/camera/camera-capture";
import { MediaImage } from "../../components/media/media-image";
import type {
  DamagedStockEntry,
  DamageAction,
} from "../../types/inventory-conditions";
import { stamp } from "../shared/format";
import "./condition-stock.css";

export function LowStockAction({
  id,
  name,
  quantity,
  minimum,
}: {
  id: string;
  name: string;
  quantity: number;
  minimum: number;
}) {
  const [open, setOpen] = useState(false),
    receive = usePermission("inventory.receive");
  const q = useRepository(
    "low-stock-" + id,
    async () => ({
      balances: (await r.inventory.balances()).filter(
        (b) => b.productId === id,
      ),
      locations: await r.locations.list(),
    }),
    open,
  );
  return (
    <>
      <button
        className="condition-badge-button"
        onClick={() => setOpen(true)}
        aria-label={"Stock warning for " + name}
      >
        <Badge tone="danger">
          <AlertTriangle size={12} />
          {quantity === 0 ? "Out of Stock" : "Low Stock"}
        </Badge>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Stock needs attention"
        description={name}
      >
        <div className="stat-grid">
          <StatCard label="Available" value={quantity} />
          <StatCard label="Reorder threshold" value={minimum} />
        </div>
        <QueryState
          pending={q.isPending}
          error={q.isError}
          retry={() => void q.refetch()}
        >
          <DataTable
            rows={q.data?.balances ?? []}
            columns={[
              {
                label: "Box",
                render: (b) =>
                  q.data?.locations.find((l) => l.id === b.locationId)?.name ??
                  "Unrecorded",
              },
              { label: "Available", render: (b) => b.quantity },
            ]}
          />
        </QueryState>
        <div className="dialog-actions">
          {receive && (
            <Link
              className="button button-primary"
              to={
                "/stock-receiving?product=" +
                id +
                "&quantity=" +
                Math.max(1, minimum * 2 - quantity)
              }
            >
              Receive Stock
            </Link>
          )}
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Dialog>
    </>
  );
}
export function ConditionOverview({ productId }: { productId: string }) {
  const q = useRepository(
      "condition-overview-" + productId,
      () => r.inventory.conditions?.(productId) ?? Promise.resolve([]),
    ),
    [open, setOpen] = useState(false),
    stock = q.data?.[0];
  return (
    <section className="condition-overview">
      <h2>Stock Overview</h2>
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <div className="stat-grid">
          <StatCard label="Available" value={stock?.available ?? "—"} />
          <StatCard
            label="Damaged"
            value={
              <button
                className="condition-damaged-count"
                onClick={() => setOpen(true)}
              >
                {stock?.damaged ?? "—"} <small>View history</small>
              </button>
            }
          />
          <StatCard label="Out for Test" value={stock?.outForTest ?? "—"} />
          <StatCard
            label="Total Physical Units"
            value={stock?.totalPhysical ?? "—"}
          />
        </div>
      </QueryState>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Damaged Inventory"
        description="Quarantined stock and its original return history."
      >
        <DamagedInventory productId={productId} />
      </Dialog>
    </section>
  );
}
export function DamagedInventory({ productId }: { productId?: string }) {
  const q = useRepository(
      "damaged-stock-" + (productId ?? "all"),
      () => r.inventory.damaged?.(productId) ?? Promise.resolve([]),
    ),
    [selected, setSelected] = useState<DamagedStockEntry | null>(null);
  return (
    <>
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <DataTable
          emptyTitle="No damaged returns"
          rows={(q.data ?? []).map((row) => ({
            ...row,
            id: row.id + ":" + row.locationId,
            lotId: row.id,
          }))}
          columns={[
            { label: "Date", render: (s) => stamp(s.createdAt) },
            {
              label: "Product",
              render: (s) => <strong>{s.productName}</strong>,
            },
            {
              label: "Quantity",
              render: (s) =>
                s.quantityUnknown
                  ? "Unverified (" + s.returnedQuantity + " returned)"
                  : s.quantity,
            },
            { label: "Customer", render: (s) => s.customerName ?? "Walk-in" },
            {
              label: "Invoice",
              render: (s) =>
                s.saleId ? (
                  <Link className="text-link" to={"/transactions/" + s.saleId}>
                    {s.invoice ?? "Original transaction"}
                  </Link>
                ) : (
                  "—"
                ),
            },
            {
              label: "Reason / Location",
              render: (s) => (
                <>
                  {s.reason}
                  <small className="cell-secondary">{s.locationPath}</small>
                </>
              ),
            },
            { label: "Employee", render: (s) => s.employeeName },
            {
              label: "Status",
              render: (s) => (
                <button
                  className="condition-badge-button"
                  onClick={() => setSelected({ ...s, id: s.lotId })}
                >
                  <Badge tone={s.quantity > 0 ? "danger" : "info"}>
                    {s.disposition}
                  </Badge>
                </button>
              ),
            },
          ]}
          onRow={(s) => setSelected({ ...s, id: s.lotId })}
        />
      </QueryState>
      {selected && (
        <DamageDetail
          key={selected.id + selected.locationId + selected.quantity}
          entry={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function DamageDetail({
  entry,
  onClose,
}: {
  entry: DamagedStockEntry;
  onClose: () => void;
}) {
  const adjust = usePermission("inventory.adjust"),
    transfer = usePermission("inventory.transfer"),
    a = useAction();
  const [requestId] = useState(() => crypto.randomUUID());
  const [action, setAction] = useState<DamageAction["action"]>(
      adjust ? "note" : "transfer",
    ),
    [quantity, setQuantity] = useState(1),
    [destination, setDestination] = useState(""),
    [notes, setNotes] = useState(""),
    [photos, setPhotos] = useState<string[]>([]),
    [preparing, setPreparing] = useState(false);
  const q = useRepository("damage-destinations", async () => ({
    damaged: (await r.inventory.conditionLocations?.("Damaged")) ?? [],
    available: (await r.inventory.conditionLocations?.("Available")) ?? [],
  }));
  const locations =
      (action === "recover" ? q.data?.available : q.data?.damaged) ?? [],
    canAct = !entry.historical && entry.quantity > 0 && (adjust || transfer);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !a.busy) onClose();
      }}
      title={entry.productName}
      description={entry.locationPath}
    >
      <div className="detail-grid">
        {Object.entries({
          Quantity: entry.quantityUnknown
            ? "Unverified historical quantity"
            : entry.quantity,
          Condition: entry.disposition,
          Reason: entry.reason,
          Employee: entry.employeeName,
          Returned: stamp(entry.createdAt),
        }).map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {entry.saleId && (
        <Link className="text-link" to={"/transactions/" + entry.saleId}>
          {entry.invoice} — original invoice
        </Link>
      )}
      <div className="condition-evidence">
        {entry.photos?.map((photo, index) => (
          <MediaImage
            key={photo}
            src={photo}
            alt={"Damage evidence " + (index + 1)}
          />
        ))}
      </div>
      {!!entry.events?.length && (
        <DataTable
          rows={entry.events}
          columns={[
            { label: "Condition history", render: (event) => event.action },
            { label: "Quantity", render: (event) => event.quantity },
            { label: "Notes", render: (event) => event.notes },
            { label: "Recorded", render: (event) => stamp(event.createdAt) },
          ]}
        />
      )}{" "}
      {entry.historical && (
        <p className="text-muted">
          This older return has no verified quarantine location. Its quantity is
          excluded from tracked physical stock.
        </p>
      )}
      {canAct && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(
              () =>
                r.inventory.damageAction!({
                  idempotencyKey: requestId,
                  lotId: entry.id,
                  sourceLocationId: entry.locationId,
                  quantity: action === "note" ? 0 : quantity,
                  expectedQuantity: entry.quantity,
                  action,
                  destinationId: destination || undefined,
                  notes,
                  photos,
                }),
              "Damaged stock history updated",
              onClose,
            );
          }}
        >
          <div className="form-grid">
            <Field label="Action">
              <AppSelect
                className="input"
                value={action}
                onChange={(e) => {
                  setAction(e.target.value as DamageAction["action"]);
                  setDestination("");
                }}
              >
                {adjust && (
                  <option value="note">Attach condition note / photos</option>
                )}
                {transfer && (
                  <option value="transfer">Transfer quarantine box</option>
                )}
                {adjust && (
                  <>
                    <option value="recover">
                      Recovered — return to sellable stock
                    </option>
                    <option value="write-off">Write off damaged stock</option>
                  </>
                )}
              </AppSelect>
            </Field>
            {action !== "note" && (
              <Field label="Quantity">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={entry.quantity}
                  step={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </Field>
            )}
            {["transfer", "recover"].includes(action) && (
              <Field
                label={
                  action === "transfer"
                    ? "Damaged / Quarantine destination"
                    : "Inspected sellable destination"
                }
              >
                <AppSelect
                  className="input"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Select a box…</option>
                  {locations
                    .filter((l) => l.locationId !== entry.locationId)
                    .map((l) => (
                      <option key={l.locationId} value={l.locationId}>
                        {l.path}
                      </option>
                    ))}
                </AppSelect>
              </Field>
            )}
            <Field label="Inspection notes / reason" wide>
              <textarea
                className="input"
                required
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
          <MediaUploader
            values={photos}
            onChange={setPhotos}
            multiple
            evidence
            onBusyChange={setPreparing}
            phoneAction={
              <CameraCapture
                type="damage-evidence"
                title={"Damage evidence: " + entry.productName}
                entityId={entry.id}
                multiple
                onImage={(photo) => setPhotos((old) => [...old, photo])}
              />
            }
          />
          {a.error && (
            <p role="alert" className="form-error">
              {a.error}
            </p>
          )}
          <div className="dialog-actions">
            <Button onClick={onClose} disabled={a.busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={a.busy || preparing}
            >
              {a.busy ? "Saving…" : "Save condition action"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
