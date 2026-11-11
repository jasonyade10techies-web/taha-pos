import { toast } from "../../stores/toast-store";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  RecordForm,
  StatusBadge,
  QueryState,
  type FormField,
} from "../../components/ui/workspace";
import { CatalogPage } from "../shared/catalog-page";
import { options, num, text } from "../shared/format";
import { Button } from "../../components/ui/button";
import { currency } from "../../lib/utils";
import type { RepairJob } from "../../types/demo";
import { RepairMedia, type RepairPhoto } from "./repair-media";
import { CustomerCombobox } from "../../components/pos/customer-combobox";
import { usePermission } from "../../hooks/use-permission";
import { apiEnabled } from "../../lib/config";
const jobStatuses: RepairJob["status"][] = [
  "Received",
  "Diagnosing",
  "Waiting Approval",
  "Waiting Part",
  "In Repair",
  "Testing",
  "Ready",
  "Delivered",
  "Cancelled",
];
export function ServicesPage() {
  return (
    <CatalogPage
      title="Repair Services"
      subtitle="Labour charges available in New Sale without stock deductions."
      load={() => r.services.list()}
      extra={
        <Link className="button button-secondary" to="/services/new">
          New Service Form
        </Link>
      }
      columns={[
        {
          label: "Service",
          render: (s) => (
            <Link to={"/services/" + s.id + "/edit"}>
              <strong>{s.name}</strong>
            </Link>
          ),
        },
        { label: "Category", render: (s) => s.category },
        { label: "Selling Price", render: (s) => currency(s.sellingPrice) },
        { label: "Minimum", render: (s) => currency(s.minimumSellingPrice) },
        {
          label: "Status",
          render: (s) => (
            <StatusBadge status={s.active ? "Active" : "Inactive"} />
          ),
        },
      ]}
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
      initial={{
        active: true,
        category: "Repair",
        sellingPrice: 800,
        minimumSellingPrice: 500,
      }}
      values={(s) => ({
        name: s.name,
        category: s.category,
        sellingPrice: s.sellingPrice,
        minimumSellingPrice: s.minimumSellingPrice,
        notes: s.notes,
        active: s.active,
      })}
      save={async (v, id) => {
        const old = id ? await r.services.get(id) : undefined;
        return r.services.save({
          id: id ?? crypto.randomUUID(),
          code: old?.code ?? "",
          name: text(v.name),
          category: text(v.category),
          sellingPrice: num(v.sellingPrice),
          minimumSellingPrice: num(v.minimumSellingPrice),
          active: Boolean(v.active),
          notes: text(v.notes),
        });
      }}
    />
  );
}
export function RepairJobsPage() {
  return (
    <CatalogPage
      title="Repair Jobs"
      subtitle="Track each device from intake through delivery."
      load={() => r.jobs.list()}
      detail={(j) => "/repair-jobs/" + j.id}
      extra={
        <Link className="button button-primary" to="/repair-jobs/new">
          Create Job
        </Link>
      }
      columns={[
        { label: "Job", render: (j) => <strong>{j.code}</strong> },
        { label: "Customer", render: (j) => j.customerName },
        {
          label: "Device / Problem",
          render: (j) => (
            <>
              {j.device}
              <small className="cell-secondary">{j.problem}</small>
            </>
          ),
        },
        {
          label: "Estimate / Advance",
          render: (j) => currency(j.estimate) + " / " + currency(j.advance),
        },
        { label: "Status", render: (j) => <StatusBadge status={j.status} /> },
      ]}
    />
  );
}
export function RepairJobPage() {
  const { id } = useParams();
  const [draftId] = useState(() => id ?? crypto.randomUUID());
  const canEmployees = usePermission("employees.view"), canCreate = usePermission("repairs.create"), canEdit = usePermission("repairs.edit");
  const q = useRepository("job-" + id, async () => ({
    job: id ? await r.jobs.get(id) : undefined,
    employees: canEmployees ? await r.employees.list() : [],
  }));
  const a = useAction();
  const [photos, setPhotos] = useState<RepairPhoto[] | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const selectedCustomer = useRepository("repair-selected-customer-" + customerId, () => customerId ? r.customers.get(customerId) : Promise.resolve(undefined));
  const navigate = useNavigate();
  const job = q.data?.job;
  const fields: FormField[] = [
    { key: "customerName", label: "Customer", required: true },
    { key: "phone", label: "Phone", required: true },
    { key: "device", label: "Device / model", required: true },
    { key: "imei", label: "IMEI" },
    { key: "problem", label: "Reported problem", required: true, wide: true },
    { key: "damage", label: "Visible damage / condition" },
    { key: "estimate", label: "Estimated price (PKR)", type: "number", min: 0 },
    ...(!apiEnabled ? [{ key: "advance", label: "Advance payment (PKR)", type: "number" as const, min: 0 }] : []),
    {
      key: "technicianId",
      label: "Technician",
      type: "select",
      options: q.data?.employees
        .filter((e) => e.status === "active")
        .map((e) => ({ value: e.id, label: e.full_name })),
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      required: true,
      options: options(jobStatuses),
    },
    { key: "notes", label: "Technician notes", type: "textarea", wide: true },
  ];
  return (
    <>
      <PageHeader
        title={job?.code ?? "Create Repair Job"}
        subtitle="Intake details, device photos and service progress."
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <section className="panel form-section">
          <RecordForm
            fields={fields}
            overrides={selectedCustomer.data ? { customerName: selectedCustomer.data.name, phone: selectedCustomer.data.phone } : undefined}
            initial={
              job
                ? {
                    customerName: job.customerName,
                    phone: job.phone,
                    device: job.device,
                    imei: job.imei,
                    problem: job.problem,
                    damage: job.damage,
                    estimate: job.estimate,
                    advance: job.advance,
                    technicianId: job.technicianId,
                    status: job.status,
                    notes: job.notes,
                  }
                : { status: "Received", estimate: 0, advance: 0 }
            }
            busy={a.busy || (apiEnabled && !(id ? canEdit : canCreate))}
            onSubmit={(v) =>
              void a.run(
                async () => {
                  const selectedCustomer = customerId ? await r.customers.get(customerId) : undefined;
                  const images = photos ?? job?.photos.map((url,i) => ({url,path:job.photoPaths?.[i],category:job.photoCategories?.[i] ?? "Before"})) ?? [];
                  return r.jobs.save({
                    id: draftId,
                    code: job?.code ?? "",
                    customerId: customerId ?? job?.customerId ?? "",
                    customerName: selectedCustomer?.name ?? text(v.customerName),
                    phone: selectedCustomer?.phone || text(v.phone),
                    device: text(v.device),
                    imei: text(v.imei),
                    problem: text(v.problem),
                    damage: text(v.damage),
                    photos: images.map(p => p.url),
                    photoPaths: images.map(p => p.path ?? ""),
                    photoCategories: images.map(p => p.category),
                    estimate: num(v.estimate),
                    advance: apiEnabled ? job?.advance ?? 0 : num(v.advance),
                    technicianId: text(v.technicianId),
                    status: text(v.status) as RepairJob["status"],
                    notes: text(v.notes),
                    createdAt: job?.createdAt ?? new Date().toISOString(),
                  });
                },
                "Repair job saved",
                (j) => navigate("/repair-jobs/" + j.id),
              )
            }
          >
            <div className="field-wide"><strong>Link customer</strong><CustomerCombobox value={customerId ?? job?.customerId ?? ""} onSelect={setCustomerId}/></div>
            <RepairMedia entityId={draftId} photos={photos ?? job?.photos.map((url,i) => ({url,path:job.photoPaths?.[i],category:job.photoCategories?.[i] ?? "Before"})) ?? []} onChange={setPhotos}/>
            <div className="auth-notice">
              <strong>Notification preview</strong>
              <p>
                When Ready: “Your {job?.device ?? "device"} is ready for
                collection at TAHA MOBILES.”
              </p>
              <Button
                size="small"
                onClick={() =>
                  toast(
                    "Demo preview: Your device is ready for collection at TAHA MOBILES. No message was sent.",
                    "info",
                  )
                }
              >
                Preview automation
              </Button>
            </div>
          </RecordForm>
          {a.error && <p className="text-danger mt-4" role="alert">{a.error}</p>}
        </section>
      </QueryState>
    </>
  );
}
