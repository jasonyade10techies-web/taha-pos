import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterBar,
  PermissionToggle,
  StatusBadge,
  RecordForm,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { num, text, options } from "../shared/format";
import type { Enquiry } from "../../types/demo";
export function WebsiteProductsPage() {
  const q = useRepository("website-products", async () => ({
    products: await r.products.pos(),
    website: await r.website.products(),
  }));
  const a = useAction();
  const [search, setSearch] = useState("");
  return (
    <>
      <PageHeader
        title="Website Products"
        subtitle="Control public visibility, availability and pricing. Exact stock remains internal."
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} />
      </FilterBar>
      <DataTable
        rows={
          q.data?.products.filter(
            (p) =>
              p.category !== "Services" &&
              p.name.toLowerCase().includes(search.toLowerCase()),
          ) ?? []
        }
        columns={[
          { label: "Product", render: (p) => <strong>{p.name}</strong> },
          {
            label: "Visible",
            render: (p) => (
              <PermissionToggle
                label="Public"
                checked={
                  q.data?.website.find((w) => w.id === p.id)?.visible ?? false
                }
                onChange={(visible) =>
                  void a.run(
                    () =>
                      r.website.saveProduct({
                        id: p.id,
                        availability: true,
                        price: p.sellingPrice,
                        featured: false,
                        ...q.data?.website.find((w) => w.id === p.id),
                        visible,
                      }),
                    "Visibility updated",
                  )
                }
              />
            ),
          },
          {
            label: "Availability",
            render: (p) => (
              <PermissionToggle
                label="Available"
                checked={
                  q.data?.website.find((w) => w.id === p.id)?.availability ??
                  true
                }
                onChange={(availability) =>
                  void a.run(
                    () =>
                      r.website.saveProduct({
                        id: p.id,
                        visible: false,
                        price: p.sellingPrice,
                        featured: false,
                        ...q.data?.website.find((w) => w.id === p.id),
                        availability,
                      }),
                    "Availability updated",
                  )
                }
              />
            ),
          },
          {
            label: "Website price (PKR)",
            render: (p) => (
              <input
                className="input"
                type="number"
                min="0"
                aria-label={"Website price for " + p.internalCode}
                defaultValue={
                  q.data?.website.find((w) => w.id === p.id)?.price ??
                  p.sellingPrice
                }
                onBlur={(e) => {
                  const price = Number(e.target.value);
                  if (
                    price !==
                    (q.data?.website.find((w) => w.id === p.id)?.price ??
                      p.sellingPrice)
                  )
                    void a.run(
                      () =>
                        r.website.saveProduct({
                          id: p.id,
                          visible: false,
                          availability: true,
                          featured: false,
                          ...q.data?.website.find((w) => w.id === p.id),
                          price,
                        }),
                      "Website price saved",
                    );
                }}
              />
            ),
          },
          {
            label: "Featured",
            render: (p) => (
              <PermissionToggle
                label="Featured"
                checked={
                  q.data?.website.find((w) => w.id === p.id)?.featured ?? false
                }
                onChange={(featured) =>
                  void a.run(
                    () =>
                      r.website.saveProduct({
                        id: p.id,
                        visible: false,
                        availability: true,
                        price: p.sellingPrice,
                        ...q.data?.website.find((w) => w.id === p.id),
                        featured,
                      }),
                    "Featured updated",
                  )
                }
              />
            ),
          },
        ]}
      />
    </>
  );
}
export function EnquiriesPage() {
  const q = useRepository("enquiries", () => r.website.enquiries.list());
  const a = useAction();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Enquiry | null>(null);
  return (
    <>
      <PageHeader
        title="Repair Enquiries"
        subtitle="Contact customers, quote a repair and convert approved enquiries into jobs."
      />
      <DataTable
        rows={q.data ?? []}
        columns={[
          {
            label: "Customer",
            render: (e) => (
              <strong>
                {e.name}
                <small className="cell-secondary">{e.phone}</small>
              </strong>
            ),
          },
          {
            label: "Device / Problem",
            render: (e) => (
              <>
                {e.device}
                <small className="cell-secondary">{e.problem}</small>
              </>
            ),
          },
          { label: "Photos", render: (e) => e.images },
          { label: "Status", render: (e) => <StatusBadge status={e.status} /> },
          {
            label: "Actions",
            render: (e) => (
              <div className="flex gap-2 flex-wrap">
                <a className="text-link" href={"tel:" + e.phone}>
                  Call
                </a>
                <a
                  className="text-link"
                  href={"https://wa.me/" + e.phone.replace(/\D/g, "")}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <Button size="small" onClick={() => setEditing(e)}>
                  Manage
                </Button>
                {!["Closed", "Converted"].includes(e.status) && (
                  <Button
                    size="small"
                    onClick={() =>
                      void a.run(
                        () => r.website.convert(e.id, "manager-1"),
                        "Enquiry converted",
                        (j) => navigate("/repair-jobs/" + j.id),
                      )
                    }
                  >
                    Convert to Job
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          title="Manage Repair Enquiry"
          description={editing.name + " · " + editing.device}
        >
          <RecordForm
            fields={[
              {
                key: "status",
                label: "Status",
                type: "select",
                required: true,
                options: options(
                  editing.jobId
                    ? ["Converted", "Closed"]
                    : ["New", "Contacted", "Quoted", "Closed"],
                ),
              },
              { key: "quote", label: "Quote (PKR)", type: "number", min: 0 },
              { key: "notes", label: "Internal notes", type: "textarea" },
            ]}
            initial={{
              status: editing.status,
              quote: editing.quote,
              notes: editing.notes,
            }}
            busy={a.busy}
            onSubmit={(v) =>
              void a.run(
                () =>
                  r.website.enquiries.save({
                    ...editing,
                    status: text(v.status) as Enquiry["status"],
                    quote: num(v.quote),
                    notes: text(v.notes),
                  }),
                "Enquiry updated",
                () => setEditing(null),
              )
            }
          />
        </Dialog>
      )}
    </>
  );
}
