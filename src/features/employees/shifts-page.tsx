import { useState } from "react";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  DataTable,
  RecordForm,
  StatusBadge,
  Tabs,
  type FormField,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { num, text, today, options } from "../shared/format";
import { currency } from "../../lib/utils";
import type { Shift } from "../../types/demo";
import {CashExceptionsNotice} from '../../components/layout/cash-exceptions-notice';
import {nativeDesktop} from '../../lib/desktop/runtime';
import {desktopScope} from '../../lib/desktop/database';
import {invoke} from '@tauri-apps/api/core';
export function ShiftsPage() {
  const q = useRepository("shifts", async () => ({
    shifts: await r.shifts.list(),
    employees: await r.employees.list(),
  }));
  const a = useAction();
  const [tab, setTab] = useState("Schedule");
  const [edit, setEdit] = useState<Shift | null | undefined>(undefined);
  const [closing, setClosing] = useState<Shift | null>(null);
  const backlog=useRepository('closing-cash-backlog-'+closing?.id,()=>invoke<{id:string;sellerId:string;capturedAt:string;registered:number}[]>('desktop_cash_backlog',{scope:desktopScope()}),nativeDesktop&&!!closing);
  const unregistered=(backlog.data??[]).filter(r=>!r.registered&&r.sellerId===closing?.employeeId);
  const checkPending=nativeDesktop&&(backlog.isPending||backlog.isError||unregistered.length>0);
  const cash = useRepository("closing-" + closing?.id, () =>
    closing ? r.shifts.closing(closing.id) : Promise.resolve(null),
  );
  const fields: FormField[] = [
    {
      key: "employeeId",
      label: "Employee",
      type: "select",
      required: true,
      options: q.data?.employees
        .filter((e) => e.status === "active")
        .map((e) => ({ value: e.id, label: e.full_name })),
    },
    { key: "date", label: "Date", type: "date", required: true },
    { key: "start", label: "Start time", type: "time", required: true },
    { key: "end", label: "End time", type: "time", required: true },
    {
      key: "status",
      label: "Status",
      type: "select",
      required: true,
      options: options(["Scheduled", "Open"]),
    },
    { key: "openingCash", label: "Opening cash (PKR)", type: "number", min: 0 },
  ];
  const rows =
    q.data?.shifts
      .filter((s) =>
        tab === "Closing History"
          ? s.status === "Closed"
          : s.status !== "Closed",
      )
      .sort((a, b) => a.date.localeCompare(b.date)) ?? [];
  return (
    <>
      <PageHeader
        title="Shifts"
        subtitle="Schedule the counter team and reconcile cash at shift closing."
        action={
          <Button variant="primary" onClick={() => setEdit(null)}>
            Schedule Shift
          </Button>
        }
      />
      <Tabs
        items={["Schedule", "Closing History"]}
        value={tab}
        onChange={setTab}
      />
      <DataTable
        rows={rows}
        columns={[
          {
            label: "Employee",
            render: (s) =>
              q.data?.employees.find((e) => e.id === s.employeeId)?.full_name,
          },
          { label: "Date", render: (s) => s.date },
          { label: "Time", render: (s) => s.start + " – " + s.end },
          { label: "Status", render: (s) => <StatusBadge status={s.status} /> },
          {
            label: tab === "Schedule" ? "Time remaining" : "Cash difference",
            render: (s) =>
              tab === "Schedule"
                ? s.date === today() && s.status === "Open"
                  ? `${Math.max(0, Math.ceil((Date.parse(s.date + "T" + s.end) - Date.now()) / 60000))} min`
                  : "—"
                : currency(s.difference ?? 0),
          },
          {
            label: "Action",
            render: (s) =>
              s.status === "Closed" ? (
                <div><span title={s.notes}>{s.notes||'Reconciled'}</span><Button size="small" variant="secondary" onClick={()=>setClosing(s)}>View Closing</Button></div>
              ) : (
                <div className="flex gap-2">
                  <Button size="small" onClick={() => setEdit(s)}>
                    Edit
                  </Button>
                  {s.status === "Open" && (
                    <Button size="small" onClick={() => setClosing(s)}>
                      Close Shift
                    </Button>
                  )}
                </div>
              ),
          },
        ]}
      />
      {edit !== undefined && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEdit(undefined);
          }}
          title={edit ? "Edit Shift" : "Schedule Shift"}
          description="One active shift per employee per day."
        >
          <RecordForm
            fields={fields}
            initial={
              edit
                ? {
                    employeeId: edit.employeeId,
                    date: edit.date,
                    start: edit.start,
                    end: edit.end,
                    status: edit.status,
                    openingCash: edit.openingCash,
                  }
                : {
                    date: today(),
                    start: "09:00",
                    end: "18:00",
                    status: "Scheduled",
                    openingCash: 10000,
                  }
            }
            busy={a.busy}
            onSubmit={(v) =>
              void a.run(
                () =>
                  r.shifts.save({
                    id: edit?.id ?? crypto.randomUUID(),
                    employeeId: text(v.employeeId),
                    date: text(v.date),
                    start: text(v.start),
                    end: text(v.end),
                    status: text(v.status) as Shift["status"],
                    openingCash: num(v.openingCash),
                    countedCash: null,
                    cashExpenses: 0,
                    expectedCash: null,
                    difference: null,
                    notes: "",
                  }),
                "Shift saved",
                () => setEdit(undefined),
              )
            }
          />
        </Dialog>
      )}
      {closing && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setClosing(null);
          }}
          title={closing.status==='Closed'?'Shift Closing':'Close Shift'}
          description="Explain any cash difference before completing the closing."
        >
          <div className="detail-grid">
            {Object.entries({
              "Opening Cash": closing.openingCash,
              "Cash Sales": cash.data?.cashSales ?? 0,
              "Old Debt Collections": cash.data?.collections ?? 0,
              "Used Device Purchases": cash.data?.purchases ?? 0,
              "Expected Cash before expenses": cash.data?.expected ?? 0,
            }).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{currency(value)}</strong>
              </div>
            ))}
          </div>
          <CashExceptionsNotice/>
          {closing.status==='Closed'&&<div className="auth-notice"><strong>Original closing snapshot</strong><p>Counted {currency(closing.countedCash??0)} · Difference {currency(closing.difference??0)}.</p><p>{closing.notes||'No closing notes.'}</p></div>}
          {checkPending&&<p role="alert" className="auth-notice">Retained cash must be submitted to the shop before this shift can close. Connect and review Synchronization Exceptions, then reopen closing. No receipt has been discarded.</p>}
          {cash.data?.offlineCash&&<div className="auth-notice"><strong>Offline cash reconciliation</strong><p>Collected {currency(cash.data.offlineCash.collected)} · Posted {currency(cash.data.offlineCash.posted)} · Unresolved {currency(cash.data.offlineCash.unposted)} · Refunded from this staff member’s drawer {currency(cash.data.offlineCash.refunded)}.</p><p>{cash.data.closingSnapshotPreserved?'The original closed-shift count remains unchanged. Review late submissions separately.':'Expected cash includes retained collections and actual exception refunds once.'}</p></div>}
          {closing.status!=='Closed'&&<RecordForm
            fields={[
              {
                key: "counted",
                label: "Counted cash (PKR)",
                type: "number",
                min: 0,
                required: true,
              },
              {
                key: "expenses",
                label: "Cash expenses (PKR)",
                type: "number",
                min: 0,
              },
              {
                key: "notes",
                label: "Cash difference reason / closing notes",
                type: "textarea",
              },
            ]}
            initial={{ counted: cash.data?.expected ?? 0, expenses: 0 }}
            key={cash.data?.expected ?? "loading"}
            busy={a.busy||checkPending}
            submit="Complete Closing"
            onSubmit={(v) =>
              void a.run(
                () =>
                  r.shifts.close(
                    closing.id,
                    num(v.counted),
                    num(v.expenses),
                    text(v.notes),
                  ),
                "Shift closed",
                () => setClosing(null),
              )
            }
          />}
        </Dialog>
      )}
    </>
  );
}
