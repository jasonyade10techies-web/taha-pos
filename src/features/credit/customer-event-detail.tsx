import { useState } from "react";
import { Link } from "react-router-dom";
import type { CustomerActivity } from "../../types/customer-activity";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { usePermission } from "../../hooks/use-permission";
import { useShopConfiguration } from "../../hooks/use-shop-configuration";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { QueryState, DataTable } from "../../components/ui/workspace";
import { MediaImage } from "../../components/media/media-image";
import { currency } from "../../lib/utils";
import { shopTimestamp } from "../../lib/shop-time";
import { historyTitle, amountDirection } from "./customer-account";
import { localDemoEnabled } from "../../lib/config";
import { proofUrl } from "../../lib/supabase/business-assets";
export function CustomerEventDetail({
  customerId,
  event,
  onClose,
}: {
  customerId: string;
  event: CustomerActivity | null;
  onClose: () => void;
}) {
  const canSales = usePermission("sales.view"),
    returnPermission = usePermission("returns.create"),
    receivePermission = usePermission("credit.receive_payment"),
    createCredit = usePermission("credit.create"),
    reports = usePermission("reports.view"),
    approvePayment = usePermission("payments.approve_electronic"),
    reversePayment = usePermission("payments.reverse"),
    canTest = usePermission("inventory.transfer");
  const canReturns = returnPermission || canSales,
    canPayments =
      receivePermission ||
      createCredit ||
      reports ||
      approvePayment ||
      reversePayment;
  const { ownerOnly } = useShopConfiguration();
  const [proof, setProof] = useState("");
  const action = useAction();
  const detail = useRepository(
    "customer-history-detail-" + (event?.id ?? ""),
    async () => {
      if (!event) return null;
      if (r.customers.activityDetail)
        return r.customers.activityDetail(customerId, event.id);
      const [sale, returned, payment, test] = await Promise.all([
        canSales && event.saleId ? r.sales.get(event.saleId) : undefined,
        canReturns && event.entityType === "return"
          ? r.sales
              .returns()
              .then((rows) => rows.find((row) => row.id === event.entityId))
          : undefined,
        canPayments && event.entityType === "payment"
          ? r.payments
              .entries()
              .then((rows) => rows.find((row) => row.id === event.entityId))
          : undefined,
        canTest && event.entityType === "test"
          ? r.credit
              .tests()
              .then((rows) => rows.find((row) => row.id === event.entityId))
          : undefined,
      ]);
      return { sale, returned, payment, test };
    },
    !!event,
  );
  const s = detail.data?.sale,
    p = detail.data?.payment,
    ret = detail.data?.returned,
    t = detail.data?.test;
  return (
    <>
      <Dialog
        open={!!event}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={event ? historyTitle(event) : "Account history"}
        description={
          event ? event.reference + " · " + shopTimestamp(event.createdAt) : ""
        }
        className="customer-history-dialog"
      >
        {event && (
          <>
            <p className="customer-event-description">{event.description}</p>
            <div className="customer-detail-facts">
              {event.amount !== undefined && (
                <div>
                  <span>{amountDirection(event) || "Amount"}</span>
                  <strong>{currency(event.amount)}</strong>
                </div>
              )}
              {event.quantity !== undefined && (
                <div>
                  <span>Quantity</span>
                  <strong>{event.quantity}</strong>
                </div>
              )}
              {event.condition && (
                <div>
                  <span>Condition</span>
                  <strong>{event.condition}</strong>
                </div>
              )}
              {event.balance !== undefined && (
                <div>
                  <span>Account balance after entry</span>
                  <strong>{currency(event.balance)}</strong>
                </div>
              )}
              {!ownerOnly &&
                event.employeeName &&
                event.employeeName !== "Staff member" && (
                  <div>
                    <span>Recorded by</span>
                    <strong>{event.employeeName}</strong>
                  </div>
                )}
            </div>
            <QueryState
              pending={detail.isPending}
              error={detail.isError}
              retry={() => void detail.refetch()}
            >
              {ret && (
                <>
                  <h3>Return details</h3>
                  <p>{ret.reason}</p>
                  <p>
                    {ret.destination} · {ret.condition ?? event.condition}
                  </p>
                  <div className="summary-line">
                    <span>Debt adjustment</span>
                    <strong>
                      {ret.creditReduction === undefined
                        ? "Not recorded"
                        : currency(ret.creditReduction)}
                    </strong>
                  </div>
                  <div className="summary-line">
                    <span>Cash / digital refund</span>
                    <strong>
                      {ret.manualRefund === undefined
                        ? "See linked refund record"
                        : currency(ret.manualRefund)}
                    </strong>
                  </div>
                  <p className="text-muted text-sm">
                    The return and any refund are separate accounting records.
                  </p>
                </>
              )}
              {p && (
                <>
                  <h3>
                    {p.kind === "refund"
                      ? p.methodId === "credit"
                        ? "Debt adjustment"
                        : "Refund details"
                      : "Payment details"}
                  </h3>
                  <div className="summary-line">
                    <span>
                      {p.methodName ?? event.description} ·{" "}
                      {p.status ?? "Recorded"}
                    </span>
                    <strong>{currency(p.amount)}</strong>
                  </div>
                  <p>{p.reference}</p>
                  <p>{p.notes}</p>
                  {p.proof && (
                    <Button
                      size="small"
                      disabled={action.busy}
                      onClick={() => {
                        if (localDemoEnabled) setProof(p.proof!);
                        else
                          void action.run(
                            () => proofUrl(p.proof!),
                            "Attachment loaded",
                            (url) => setProof(url ?? ""),
                          );
                      }}
                    >
                      View attachment
                    </Button>
                  )}
                </>
              )}
              {t && (
                <>
                  <h3>Test item details</h3>
                  <p>Status: {t.status}</p>
                  <p>Taken on {shopTimestamp(t.takenDate)}</p>
                  <p>
                    {t.dueDate
                      ? "Return due " + shopTimestamp(t.dueDate)
                      : "No time limit"}
                  </p>
                  <p>{t.notes}</p>
                </>
              )}
              {s && (
                <>
                  <h3>
                    {event.entityType === "return"
                      ? "Original invoice"
                      : "Purchase details"}{" "}
                    · {s.invoice}
                  </h3>
                  <p>
                    {s.status} · Total {currency(s.total)}
                    {s.outstanding !== undefined
                      ? " · Outstanding " + currency(s.outstanding)
                      : ""}
                  </p>
                  <DataTable
                    rows={s.lines.map((line, index) => ({
                      ...line,
                      id: line.productId + index,
                    }))}
                    columns={[
                      { label: "Item / service", render: (line) => line.name },
                      { label: "Quantity", render: (line) => line.quantity },
                      {
                        label: "Unit price",
                        render: (line) => currency(line.unitPrice),
                      },
                      {
                        label: "Amount",
                        render: (line) => currency(line.total),
                      },
                    ]}
                  />
                  <h3>Payment history</h3>
                  {s.payments.length ? (
                    s.payments.map((payment, index) => (
                      <div className="summary-line" key={payment.id ?? index}>
                        <span>
                          {payment.methodName ??
                            payment.methodKind ??
                            payment.methodId}{" "}
                          · {payment.kind ?? "sale"} ·{" "}
                          {payment.status ?? "Recorded"} {payment.reference}
                        </span>
                        <strong>{currency(payment.amount)}</strong>
                        {payment.proof && (
                          <Button
                            size="small"
                            disabled={action.busy}
                            onClick={() => {
                              if (localDemoEnabled) setProof(payment.proof!);
                              else
                                void action.run(
                                  () => proofUrl(payment.proof!),
                                  "Attachment loaded",
                                  (url) => setProof(url ?? ""),
                                );
                            }}
                          >
                            View attachment
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">
                      No payment recorded on this invoice.
                    </p>
                  )}
                  <Link
                    className="button button-secondary"
                    to={"/transactions/" + s.id}
                  >
                    Open invoice
                  </Link>
                </>
              )}
              {event.entityType === "ledger" && (
                <p className="text-muted">
                  This is an account ledger entry. Charges, payments, returns
                  and reversals retain their separate references.
                </p>
              )}
              {event.entityType.startsWith("reminder") && (
                <p className="text-muted">
                  This records manual reminder preparation or contact activity;
                  it does not establish delivery.
                </p>
              )}
              {!s && event.saleId && canSales && !detail.isPending && (
                <p className="text-muted">
                  The original invoice is unavailable. The retained event above
                  is preserved.
                </p>
              )}
            </QueryState>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!proof}
        onOpenChange={(open) => {
          if (!open) setProof("");
        }}
        title="Payment attachment"
      >
        <MediaImage
          src={proof}
          alt="Authorized payment attachment"
          className="proof-preview"
        />
      </Dialog>
    </>
  );
}
