import { AppSelect } from '../../components/ui/app-select';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  RecordForm,
  type FormField,
} from "../../components/ui/workspace";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useCartStore } from "../../stores/cart-store";
import { today, num, text } from "../shared/format";
import type { TestOut } from "../../types/demo";
import {localDemoEnabled} from "../../lib/config";
import {ReminderButton} from './reminder-button';
import {dueState} from '../../lib/reminders';
import {shopTimestamp} from '../../lib/shop-time';
import {useShopClock} from '../../hooks/use-shop-clock';
export function TestPage() {
  const now=useShopClock();
  const q = useRepository("tests", async () => ({
    tests: await r.credit.tests(),
    customers: await r.customers.list(),
    products: await r.products.list(),
    pos: await r.products.pos(),
    locations: await r.locations.list(),
  }));
  const a = useAction();
  const navigate = useNavigate();
  const [add, setAdd] = useState(false);
  const [extend, setExtend] = useState<TestOut | null>(null);
  const [returning,setReturning]=useState<TestOut|null>(null);
  const [destination,setDestination]=useState("");
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const fields: FormField[] = [
    {
      key: "customerId",
      label: "Customer / shop",
      type: "select",
      required: true,
      options: q.data?.customers.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: "productId",
      label: "Product",
      type: "select",
      required: true,
      options: q.data?.products
        .filter((p) => p.state === "active")
        .map((p) => ({ value: p.id, label: p.name + " · " + p.internalCode })),
    },
    {
      key: "locationId",
      label: "Source box",
      type: "select",
      required: true,
      options: q.data?.locations
        .filter((l) => l.kind === "box" && !l.archived&&l.stockCondition!=='Damaged')
        .map((l) => ({ value: l.id, label: l.code + " · " + l.name })),
    },
    {
      key: "quantity",
      label: "Quantity",
      type: "number",
      min: 1,
      required: true,
    },
    { key: "takenDate", label: "Taken date", type: "date", required: true },
    { key: "dueDate", label: "Due date and time", type: "datetime", required: true },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
  const convert = (t: TestOut) => {
    const product = q.data?.pos.find((p) => p.id === t.productId);
    if (!product) return;
    const cart = useCartStore.getState();
    cart.clear();
    cart.add({ ...product, quantity: product.quantity + t.quantity });
    cart.changeQuantity(product.id, t.quantity);
    useCartStore.setState({ customerId: t.customerId, sourceTestId: t.id });
    navigate("/pos");
  };
  return (
    <>
      <PageHeader
        title="Out for Test"
        subtitle="Track items with customers while keeping them out of available stock."
        action={
          <Button variant="primary" disabled={q.isPending || q.isError} onClick={() => {setRequestId(crypto.randomUUID());setAdd(true);}}>
            Send for Test
          </Button>
        }
      />
      <DataTable
        rows={q.data?.tests ?? []}
        columns={[
          { label: "Reference", render: (t) => t.code },
          {
            label: "Customer",
            render: (t) =>
              q.data?.customers.find((c) => c.id === t.customerId)?.name,
          },
          {
            label: "Product",
            render: (t) =>
              q.data?.products.find((p) => p.id === t.productId)?.name,
          },
          { label: "Quantity", render: (t) => t.quantity },
          { label: "Due Date", render: (t) => <>{shopTimestamp(t.dueDate)}<small className="cell-secondary">{t.status==='OUT'?dueState(t.dueDate,3,now).label:''}</small></> },
          {
            label: "Status",
            render: (t) => (
              <StatusBadge
                status={
                  t.status !== "OUT"
                    ? t.status
                    : dueState(t.dueDate,3,now).status
                }
              />
            ),
          },
          {
            label: "Actions",
            render: (t) =>
              t.status === "OUT" ? (
                <div className="flex gap-2 flex-wrap">
                  <ReminderButton customerId={t.customerId} obligationId={'test:'+t.id} kind="test" label="Return Reminder"/>
                  <Button
                    size="small"
                    onClick={() => {if(localDemoEnabled)void a.run(()=>r.credit.returnTest(t.id),"Test items returned");else {setReturning(t);setDestination(t.locationId);}}}
                  >
                    Return
                  </Button>
                  <Button size="small" onClick={() => convert(t)}>
                    Convert to Sale
                  </Button>
                  <Button size="small" onClick={() => setExtend(t)}>
                    Extend
                  </Button>
                </div>
              ) : (
                "Closed"
              ),
          },
        ]}
      />
      <Dialog
        open={add}
        onOpenChange={setAdd}
        title="Send Out for Test"
        description="Stock will be reserved without recording revenue."
      >
        <RecordForm
          fields={fields}
          initial={{
            quantity: 1,
            takenDate: today(),
            dueDate: new Date(today()+'T18:00:00+05:00').toISOString(),
            locationId:localDemoEnabled ? "box-12-B-04" : q.data?.locations.find(l=>l.kind==="box" && !l.archived && l.stockCondition!=="Damaged")?.id ?? "",
          }}
          busy={a.busy}
          submit="Send Items"
          onSubmit={(v) =>
            void a.run(
              () =>
                r.credit.send({
                  id: requestId,
                  code: "",
                  customerId: text(v.customerId),
                  productId: text(v.productId),
                  locationId: text(v.locationId),
                  quantity: num(v.quantity),
                  takenDate: text(v.takenDate),
                  dueDate: text(v.dueDate),
                  employeeId: "",
                  notes: text(v.notes),
                  status: "OUT",
                }),
              "Items sent for testing",
              () => setAdd(false),
            )
          }
        />
      </Dialog>
      {returning && <Dialog open title="Return Test Items" description="Choose the active destination box. This restores stock without creating a sale." onOpenChange={open=>{if(!open)setReturning(null);}}><label className="form-field">Destination box<AppSelect className="input" value={destination} onChange={e=>setDestination(e.target.value)}>{q.data?.locations.filter(l=>l.kind==="box" && !l.archived && l.stockCondition!=="Damaged").map(l=><option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}</AppSelect></label><div className="dialog-actions"><Button variant="primary" disabled={a.busy || !destination} onClick={()=>void a.run(()=>r.credit.returnTest(returning.id,destination),"Test items returned",()=>setReturning(null))}>Return Items</Button></div></Dialog>}
      {extend && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setExtend(null);
          }}
          title="Extend Test Deadline"
          description={extend.code}
        >
          <RecordForm
            fields={[
              {
                key: "date",
                label: "New due date and time",
                type: "datetime",
                required: true,
              },
            ]}
            initial={{ date: extend.dueDate }}
            onSubmit={(v) =>
              void a.run(
                () => r.credit.extendTest(extend.id, text(v.date)),
                "Deadline extended",
                () => setExtend(null),
              )
            }
          />
        </Dialog>
      )}
    </>
  );
}
