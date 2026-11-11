import { useState } from "react";
import { repositories as r } from "../../lib/repositories";
import { CatalogPage } from "../shared/catalog-page";
import { num, text, options, today } from "../shared/format";
import { ImageUploader, StatusBadge } from "../../components/ui/workspace";
import { currency } from "../../lib/utils";
import type { Coupon, PaymentMethod } from "../../types/demo";
import {usePermission} from "../../hooks/use-permission";
import {localDemoEnabled} from "../../lib/config";
import {useRepository,useAction} from "../../hooks/use-repository";
import {DataTable,PageHeader} from "../../components/ui/workspace";
import {Button} from "../../components/ui/button";
export function CouponsPage() {
  return (
    <CatalogPage
      title="Coupons"
      subtitle="Configure local promotions, eligibility and usage limits."
      load={() => r.coupons.list()}
      columns={[
        { label: "Code", render: (c) => <strong>{c.code}</strong> },
        {
          label: "Discount",
          render: (c) =>
            c.type === "Percentage" ? c.value + "%" : currency(c.value),
        },
        { label: "Dates", render: (c) => c.start + " → " + c.end },
        {
          label: "Usage",
          render: (c) => c.uses + " / " + (c.maxUses || "Unlimited"),
        },
        { label: "Eligible", render: (c) => c.eligible },
        {
          label: "Status",
          render: (c) => (
            <StatusBadge status={c.active ? "Active" : "Inactive"} />
          ),
        },
      ]}
      fields={[
        { key: "code", label: "Coupon code", required: true },
        {
          key: "type",
          label: "Discount type",
          type: "select",
          options: options(["Percentage", "Fixed"]),
          required: true,
        },
        {
          key: "value",
          label: "Discount value",
          type: "number",
          min: 0.01,
          required: true,
        },
        { key: "start", label: "Start date", type: "date", required: true },
        { key: "end", label: "End date", type: "date", required: true },
        {
          key: "minimum",
          label: "Minimum purchase (PKR)",
          type: "number",
          min: 0,
        },
        {
          key: "maxUses",
          label: "Maximum uses (0 = unlimited)",
          type: "number",
          min: 0,
        },
        {
          key: "perCustomerLimit",
          label: "Uses per customer (0 = unlimited)",
          type: "number",
          min: 0,
        },
        {
          key: "eligible",
          label: "Eligible items",
          type: "select",
          options: options(["All", "Products", "Categories", "Services"]),
          required: true,
        },
        {
          key: "targets",
          label: "Eligible product IDs / categories (comma separated)",
          wide: true,
        },
        { key: "active", label: "Active", type: "checkbox" },
      ]}
      initial={{
        type: "Percentage",
        value: 10,
        start: today(),
        end: today(),
        minimum: 0,
        maxUses: 0,
        perCustomerLimit: 0,
        eligible: "All",
        active: true,
      }}
      values={(c) => ({ ...c, targets: c.targets.join(", ") })}
      save={async (v, id) => {
        const old = id ? await r.coupons.get(id) : undefined;
        return r.coupons.save({
          id: id ?? crypto.randomUUID(),
          code: text(v.code).toUpperCase().trim(),
          type: text(v.type) as Coupon["type"],
          value: num(v.value),
          start: text(v.start),
          end: text(v.end),
          minimum: num(v.minimum),
          maxUses: num(v.maxUses),
          uses: old?.uses ?? 0,
          perCustomerLimit: num(v.perCustomerLimit),
          eligible: text(v.eligible) as Coupon["eligible"],
          targets: text(v.targets)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          active: Boolean(v.active),
        });
      }}
    />
  );
}
export function PaymentsPage() {
  const [qr, setQr] = useState<string | null>(null);
  const canManage=usePermission("settings.manage");
  const canReverse=usePermission("payments.reverse");
  const entries=useRepository("payment-entries",()=>r.payments.entries(),!localDemoEnabled);
  const a=useAction();

  return (
    <>
      <CatalogPage
        title="Payment Methods"
        subtitle="Enabled methods and account details are used directly at checkout."
        load={async () => (await r.payments.list()).filter(m=>localDemoEnabled || m.kind!=="Credit")}
        onEdit={() => setQr(null)}
        renderFormExtra={(m) => (
          <ImageUploader
            value={qr ?? m?.qr ?? ""}
            onChange={setQr}
            label="Upload payment QR"
          />
        )}
        columns={[
          { label: "Method", render: (m) => <strong>{m.name}</strong> },
          { label: "Type", render: (m) => m.kind },
          { label: "Account title", render: (m) => m.title },
          { label: "Account / IBAN", render: (m) => m.number || m.iban || "—" },
          {
            label: "Status",
            render: (m) => (
              <StatusBadge status={m.enabled ? "Active" : "Inactive"} />
            ),
          },
        ]}
        fields={[
          { key: "name", label: "Method name", required: true },
          {
            key: "kind",
            label: "Type",
            type: "select",
            options: options(localDemoEnabled ? ["Cash", "Digital", "Credit"] : ["Cash","Digital"]),
            required: true,
          },
          { key: "title", label: "Account title" },
          { key: "number", label: "Account / mobile number" },
          { key: "iban", label: "IBAN" },
          ...(!localDemoEnabled ? [{key:"subtype",label:"Provider",type:"select" as const,options:options(["Cash","JazzCash","Easypaisa","Bank","Card","Other"])},{key:"requiresProof",label:"Require proof",type:"checkbox" as const},{key:"sortOrder",label:"Display order",type:"number" as const,min:0}] : []),
          { key: "enabled", label: "Enabled at checkout", type: "checkbox" },
        ]}
        initial={{ kind: "Digital", enabled: true,subtype:"Other",requiresProof:true,sortOrder:0 }}
        values={(m) => ({ ...m })}
        save={canManage ? async (v, id) => {
          const old = id ? await r.payments.get(id) : undefined;
          return r.payments.save({
            id: id ?? crypto.randomUUID(),
            name: text(v.name),
            kind: text(v.kind) as PaymentMethod["kind"],
            title: text(v.title),
            number: text(v.number),
            iban: text(v.iban),
            enabled: Boolean(v.enabled),
            qr: qr ?? old?.qr ?? "",
            qrPath:old?.qrPath,
            subtype:text(v.subtype) as PaymentMethod["subtype"],requiresProof:Boolean(v.requiresProof),sortOrder:num(v.sortOrder),
          });
        } : undefined}
      />
      {!localDemoEnabled && <><PageHeader title="Payment Records" subtitle="Original payments and append-only reversals. External refunds are manual."/><DataTable rows={entries.data ?? []} columns={[{label:"Reference",render:p=>p.code},{label:"Method",render:p=>p.methodName},{label:"Kind",render:p=>p.kind},{label:"Amount",render:p=>currency(p.amount)},{label:"Status",render:p=><StatusBadge status={p.status ?? "Pending"}/>},{label:"Actions",render:p=>canReverse && p.status==="Confirmed" && ["sale","collection"].includes(p.kind) ? <Button size="small" onClick={()=>{const reason=window.prompt("Reason for reversing this payment (no automatic gateway refund)");if(reason?.trim())void a.run(()=>r.payments.reverse!(p.id,reason),"Payment reversed");}}>Reverse</Button> : "—"}]}/></>}
    </>
  );
}
