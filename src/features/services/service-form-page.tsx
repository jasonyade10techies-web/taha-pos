import { useNavigate, useParams, Link } from "react-router-dom";
import { repositories } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  RecordForm,
  QueryState,
} from "../../components/ui/workspace";
import { text, num } from "../shared/format";
export function ServiceFormPage() {
  const { id } = useParams();
  const q = useRepository("service-form-" + id, () =>
    id ? repositories.services.get(id) : Promise.resolve(undefined),
  );
  const a = useAction();
  const navigate = useNavigate();
  const s = q.data;
  return (
    <>
      <PageHeader
        title={id ? "Edit Repair Service" : "Add Repair Service"}
        subtitle="Service charges have no inventory balance."
        action={
          <Link className="button button-secondary" to="/services">
            Cancel
          </Link>
        }
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <section className="panel form-section">
          <RecordForm
            key={id ?? "new"}
            fields={[
              { key: "name", label: "Service name", required: true },
              { key: "category", label: "Category", required: true },
              {
                key: "sellingPrice",
                label: "Selling price (PKR)",
                type: "number",
                min: 1,
                required: true,
              },
              {
                key: "minimumSellingPrice",
                label: "Minimum price (PKR)",
                type: "number",
                min: 0,
                required: true,
              },
              { key: "notes", label: "Description", type: "textarea" },
              { key: "active", label: "Active", type: "checkbox" },
            ]}
            initial={
              s
                ? {
                    name: s.name,
                    category: s.category,
                    sellingPrice: s.sellingPrice,
                    minimumSellingPrice: s.minimumSellingPrice,
                    notes: s.notes,
                    active: s.active,
                  }
                : {
                    active: true,
                    category: "Repair",
                    sellingPrice: 800,
                    minimumSellingPrice: 500,
                  }
            }
            busy={a.busy}
            submit="Save Service"
            onSubmit={(v) =>
              void a.run(
                () =>
                  repositories.services.save({
                    id: id ?? crypto.randomUUID(),
                    code: s?.code ?? "",
                    name: text(v.name),
                    category: text(v.category),
                    sellingPrice: num(v.sellingPrice),
                    minimumSellingPrice: num(v.minimumSellingPrice),
                    active: Boolean(v.active),
                    notes: text(v.notes),
                  }),
                "Service saved",
                () => navigate("/services"),
              )
            }
          />
        </section>
      </QueryState>
    </>
  );
}
