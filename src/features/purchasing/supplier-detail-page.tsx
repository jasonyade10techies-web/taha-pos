import { Link, useParams } from "react-router-dom";
import { repositories } from "../../lib/repositories";
import { useRepository } from "../../hooks/use-repository";
import {
  PageHeader,
  QueryState,
  DataTable,
  StatusBadge,
} from "../../components/ui/workspace";
export function SupplierDetailPage() {
  const { id = "" } = useParams();
  const q = useRepository("supplier-" + id, async () => ({
    supplier: await repositories.suppliers.get(id),
    receipts: (await repositories.inventory.drafts()).filter(
      (d) => d.supplierId === id,
    ),
    products: await repositories.products.list(),
  }));
  const s = q.data?.supplier;
  return (
    <>
      <PageHeader
        title={s?.name ?? "Supplier"}
        subtitle={s?.address ?? "Contact and purchase history"}
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <section className="panel form-section">
          <div className="detail-grid">
            <div>
              <span>Phone</span>
              <a href={"tel:" + s?.phone}>{s?.phone}</a>
            </div>
            <div>
              <span>WhatsApp</span>
              <a
                className="text-link"
                href={"https://wa.me/" + s?.whatsapp.replace(/\D/g, "")}
                target="_blank"
                rel="noreferrer"
              >
                {s?.whatsapp}
              </a>
            </div>
            <div>
              <span>Notes</span>
              <strong>{s?.notes || "—"}</strong>
            </div>
          </div>
        </section>
        <h2 className="section-title mt-6 mb-4">Products Received</h2>
        <DataTable
          rows={
            q.data?.receipts.flatMap((d) =>
              d.lines.map((line, i) => ({
                ...line,
                id: d.id + "-" + i,
                reference: d.reference,
                date: d.date,
                status: d.status,
              })),
            ) ?? []
          }
          columns={[
            { label: "Reference", render: (l) => l.reference },
            {
              label: "Product",
              render: (l) => (
                <Link to={"/products/" + l.productId}>
                  {q.data?.products.find((p) => p.id === l.productId)?.name}
                </Link>
              ),
            },
            { label: "Quantity", render: (l) => l.quantity },
            { label: "Date", render: (l) => l.date },
            {
              label: "Status",
              render: (l) => <StatusBadge status={l.status} />,
            },
          ]}
        />
      </QueryState>
    </>
  );
}
