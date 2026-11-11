import {MediaImage as PrivateMediaImage} from '../../components/media/media-image';
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  RecordForm,
  QueryState,
  StatusBadge,
  type FormField,
} from "../../components/ui/workspace";
import { CatalogPage } from "../shared/catalog-page";
import { options, num, text } from "../shared/format";
import { Button } from "../../components/ui/button";
import { MediaUploader } from "../../components/media/media-uploader";
import type { MediaImage, DevicePurchase } from "../../types/demo";
import { currency } from "../../lib/utils";
import { usePermission } from "../../hooks/use-permission";
import {localDemoEnabled} from "../../lib/config";
import { CameraCapture } from "../../components/camera/camera-capture";
export function BuyDevicePage() {
  const q = useRepository("device-locations", () => r.locations.list());
  const a = useAction();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<MediaImage[]>([]);
  const [purchaseId]=useState(()=>crypto.randomUUID());
  const fields: FormField[] = [
    { key: "seller", label: "Seller name", required: true },
    { key: "phone", label: "Phone", required: true },
    { key: "cnic", label: "CNIC" },
    { key: "address", label: "Address" },
    { key: "brand", label: "Brand", required: true },
    { key: "model", label: "Model", required: true },
    { key: "storage", label: "Storage" },
    { key: "color", label: "Color" },
    { key: "imei1", label: "IMEI 1 (15 digits)" },
    { key: "imei2", label: "IMEI 2 (optional)" },
    { key: "serial", label: "Serial number" },
    {
      key: "pta",
      label: "PTA status",
      type: "select",
      options: options(["Approved", "Non-PTA", "Unknown"]),
    },
    {
      key: "battery",
      label: "Battery health (%)",
      type: "number",
      min: 0,
      max: 100,
    },
    { key: "condition", label: "Condition", type: "textarea" },
    { key: "accessories", label: "Accessories" },
    {
      key: "purchasePrice",
      label: "Purchase price (PKR)",
      type: "number",
      min: 1,
      required: true,
    },
    {
      key: "targetPrice",
      label: "Target selling price (PKR)",
      type: "number",
      min: 1,
      required: true,
    },
    {
      key: "minimumPrice",
      label: "Minimum selling price (PKR)",
      type: "number",
      min: 0,
      required: true,
    },
    {
      key: "locationId",
      label: "Storage box",
      type: "select",
      required: true,
      options: q.data
        ?.filter((l) => l.kind === "box" && !l.archived)
        .map((l) => ({ value: l.id, label: l.code + " · " + l.name })),
    },
  ];
  return (
    <>
      <PageHeader
        title="Buy Device"
        subtitle="Record a used phone purchase and create individually tracked inventory."
      />
      <section className="panel form-section">
        <RecordForm
          fields={fields}
          initial={{ pta: "Approved", battery: 100, locationId:localDemoEnabled ? "box-04-C-02" : q.data?.find(l=>l.kind==="box" && !l.archived)?.id ?? "" }}
          busy={a.busy}
          submit="Save Purchase"
          onSubmit={(v) =>
            void a.run(
              () =>
                r.devices.purchase(
                  {
                    id: purchaseId,
                    code: "",
                    productId: "",
                    seller: text(v.seller),
                    phone: text(v.phone),
                    cnic: text(v.cnic),
                    address: text(v.address),
                    brand: text(v.brand),
                    model: text(v.model),
                    storage: text(v.storage),
                    color: text(v.color),
                    imei1: text(v.imei1),
                    imei2: text(v.imei2),
                    serial: text(v.serial),
                    pta: text(v.pta),
                    battery: num(v.battery),
                    condition: text(v.condition),
                    accessories: text(v.accessories),
                    photos: photos.map(p=>p.url),
                    photoPaths: photos.map(p=>p.path ?? ""),
                    purchasePrice: num(v.purchasePrice),
                    targetPrice: num(v.targetPrice),
                    minimumPrice: num(v.minimumPrice),
                    status: "In Stock",
                    createdAt: new Date().toISOString(),
                  },
                  text(v.locationId),
                ),
              "Device purchase saved",
              (d) => navigate("/purchased-devices/" + d.id),
            )
          }
        >
          <MediaUploader evidence multiple values={photos.map(p=>p.url)} onChange={urls=>setPhotos(urls.map(url=>photos.find(p=>p.url===url) ?? {url}))} label="Upload device photos"/>
          <CameraCapture type="used-device-photo" title="Used Device Photo" entityId={purchaseId} onImage={url=>setPhotos(old=>[...old,{url}])} onStoredImage={({preview,path})=>setPhotos(old=>[...old,{url:preview,path}])} compact />
        </RecordForm>
      </section>
    </>
  );
}
export function PurchasedDevicesPage() {
  return (
    <CatalogPage
      title="Purchased Devices"
      subtitle="Individually tracked used phones and their sale status."
      load={() => r.devices.list()}
      detail={(d) => "/purchased-devices/" + d.id}
      extra={
        <Link className="button button-primary" to="/buy-device">
          Buy Device
        </Link>
      }
      columns={[
        { label: "Purchase", render: (d) => d.code },
        {
          label: "Device",
          render: (d) => d.brand + " " + d.model + " · " + d.storage,
        },
        { label: "IMEI", render: (d) => d.imei1 || "—" },
        { label: "Selling Price", render: (d) => currency(d.targetPrice) },
        { label: "Status", render: (d) => <StatusBadge status={d.status} /> },
      ]}
    />
  );
}
export function DeviceDetailPage() {
  const { id = "" } = useParams();
  const q = useRepository("device-" + id, () => r.devices.get(id));
  const a = useAction();
  const cost = usePermission("costs.view_purchase_cost");
  const d = q.data;
  return (
    <>
      <PageHeader
        title={d ? d.brand + " " + d.model : "Purchased Device"}
        subtitle={d?.code ?? "Device details"}
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {d && (
          <section className="panel form-section">
            <div className="detail-grid">
              {Object.entries(d)
                .filter(
                  ([k]) =>
                    !["photos", "photoPaths", "id", "productId", "purchasePrice"].includes(k),
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>{text(v) || "—"}</strong>
                  </div>
                ))}
              {cost && (
                <div>
                  <span>Purchase price</span>
                  <strong>{currency(d.purchasePrice)}</strong>
                </div>
              )}
            </div>
            <div className="device-photo-gallery">{d.photos.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer"><PrivateMediaImage className="detail-photo" alt={`Purchased device photo ${i+1}`} src={url}/></a>)}</div>
            <div className="form-actions">
              <Link
                className="button button-secondary"
                to={"/products/" + d.productId}
              >
                Inventory Record
              </Link>
              {d.status !== "Sold" &&
                (
                  [
                    "In Stock",
                    "Repair Needed",
                    "Reserved",
                  ] as DevicePurchase["status"][]
                ).map((status) => (
                  <Button
                    key={status}
                    disabled={a.busy || d.status === status}
                    onClick={() =>
                      void a.run(
                        () => r.devices.updateStatus(id, status),
                        "Device status updated",
                      )
                    }
                  >
                    {status}
                  </Button>
                ))}
            </div>
          </section>
        )}
      </QueryState>
    </>
  );
}
export function SuppliersPage() {
  const details = useRepository("supplier-receiving", () =>
    r.inventory.drafts(),
  );
  return (
    <CatalogPage
      title="Suppliers"
      subtitle="Contacts and receiving history. Supplier debt accounting is a later phase."
      load={() => r.suppliers.list()}
      columns={[
        {
          label: "Supplier",
          render: (s) => (
            <Link to={"/suppliers/" + s.id}>
              <strong>{s.name}</strong>
            </Link>
          ),
        },
        { label: "Phone", render: (s) => s.phone },
        {
          label: "WhatsApp",
          render: (s) => (
            <a
              className="text-link"
              href={"https://wa.me/" + s.whatsapp.replace(/\D/g, "")}
              target="_blank"
              rel="noreferrer"
            >
              {s.whatsapp}
            </a>
          ),
        },
        {
          label: "Received Units",
          render: (s) =>
            details.data
              ?.filter((d) => d.supplierId === s.id && d.status === "Received")
              .reduce(
                (n, d) => n + d.lines.reduce((v, l) => v + l.quantity, 0),
                0,
              ) ?? 0,
        },
        {
          label: "Last Purchase",
          render: (s) =>
            details.data
              ?.filter((d) => d.supplierId === s.id && d.status === "Received")
              .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "—",
        },
        { label: "Notes", render: (s) => s.notes },
      ]}
      fields={[
        { key: "name", label: "Supplier name", required: true },
        { key: "phone", label: "Phone" },
        { key: "whatsapp", label: "WhatsApp" },
        { key: "address", label: "Address" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      values={(s) => ({ ...s })}
      initial={{}}
      save={(v, id) =>
        r.suppliers.save({
          id: id ?? crypto.randomUUID(),
          name: text(v.name),
          phone: text(v.phone),
          whatsapp: text(v.whatsapp),
          address: text(v.address),
          notes: text(v.notes),
        })
      }
    />
  );
}
