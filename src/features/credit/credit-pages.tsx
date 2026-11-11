import { MediaImage } from "../../components/media/media-image";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import {
  PageHeader,
  QueryState,
  RecordForm,
  ImageUploader,
  type FormField,
} from "../../components/ui/workspace";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { CatalogPage } from "../shared/catalog-page";
import { options, num, text } from "../shared/format";
import { currency } from "../../lib/utils";
import type { Customer } from "../../types/demo";
import { localDemoEnabled } from "../../lib/config";
import { usePermission } from "../../hooks/use-permission";
import { CreditPaymentForm } from "../../components/pos/credit-payment-form";
import { CameraCapture } from "../../components/camera/camera-capture";
import { CustomerActivity } from "./customer-activity";
import { useCartStore } from "../../stores/cart-store";
import { ReminderButton } from "./reminder-button";
import { dueState } from "../../lib/reminders";
import { shopTimestamp } from "../../lib/shop-time";
import { useShopClock } from "../../hooks/use-shop-clock";
import { StatusBadge, EmptyState } from "../../components/ui/workspace";
import { CustomerReminder } from "./customer-reminder";
import {
  allCustomerActivity,
  ledgerSummary,
  obligationTiming,
} from "./customer-account";
import { normalizeWhatsapp, whatsappUrl } from "../../lib/reminders";
import "./customer-activity.css";

const customerFields: FormField[] = [
  { key: "name", label: "Customer / shop name", required: true },
  {
    key: "type",
    label: "Account type",
    type: "select",
    required: true,
    options: options(["Individual", "Shop / Business"]),
  },
  {
    key: "shopName",
    label: "Shop name",
    visibleWhen: (v) => v.type === "Shop / Business",
  },
  {
    key: "ownerName",
    label: "Owner name",
    visibleWhen: (v) => v.type === "Shop / Business",
  },
  { key: "collectingPerson", label: "Person collecting items" },
  { key: "phone", label: "Phone" },
  {
    key: "whatsappSameAsPhone",
    label: "WhatsApp same as phone",
    type: "checkbox",
  },
  {
    key: "whatsappNumber",
    label: "WhatsApp number",
    visibleWhen: (v) => v.whatsappSameAsPhone === false,
    help: "Use a Pakistani mobile number or an international number with its country code.",
  },
  { key: "address", label: "Address" },
  {
    key: "creditLimit",
    label: "Credit limit (PKR, blank for no limit)",
    type: "number",
    min: 0,
  },
  {
    key: "creditEnabled",
    label: "Enable credit",
    type: "checkbox",
    help: "Allow unpaid balances on this customer's account. A phone number is required.",
  },
  {
    key: "dueAt",
    label: "Default credit due date and time",
    type: "datetime",
    help: "Used for new credit sales. Credit limits are configured separately.",
  },
  {
    key: "reminderEnabled",
    label: "Allow manual reminders for this account",
    type: "checkbox",
  },
  {
    key: "tags",
    label: "Tags (comma separated)",
    help: "Regular, Nearby Shop, VIP or Wholesale. Tags do not change pricing.",
  },
  { key: "notes", label: "Notes", type: "textarea", wide: true },
];
export function CreditPage() {
  const now = useShopClock(),
    obligations = useRepository(
      "credit-reminder-obligations",
      () => r.customers.reminders?.() ?? Promise.resolve([]),
    ),
    settings = useRepository("credit-reminder-policy", () => r.settings.get());
  const ledger = useRepository("ledger", () => r.credit.ledger());
  const nextDueByCustomer = new Map<string, string>();
  for (const obligation of obligations.data ?? []) {
    if (obligation.kind !== "credit" || !obligation.dueAt) continue;
    const previous = nextDueByCustomer.get(obligation.customerId);
    if (!previous || Date.parse(obligation.dueAt) < Date.parse(previous))
      nextDueByCustomer.set(obligation.customerId, obligation.dueAt);
  }
  return (
    <CatalogPage
      title="Credit Accounts"
      subtitle="Customers and nearby shops with a clear debit and payment history."
      load={() => r.customers.list()}
      detail={(c) => "/credit/" + c.id}
      extra={
        <Link className="button button-primary" to="/credit/new">
          Add Account
        </Link>
      }
      columns={[
        { label: "Account", render: (c) => <strong>{c.name}</strong> },
        { label: "Type", render: (c) => c.type },
        { label: "Phone", render: (c) => c.phone },
        {
          label: "Next Due",
          render: (c) => {
            const due = nextDueByCustomer.get(c.id);
            return due ? shopTimestamp(due) : "Not configured";
          },
        },
        {
          label: "Days Remaining",
          render: (c) =>
            dueState(
              nextDueByCustomer.get(c.id),
              settings.data?.reminderWarningDays ?? 3,
              now,
            ).label,
        },
        {
          label: "Due Status",
          render: (c) => (
            <StatusBadge
              status={
                (c.outstanding ??
                  ledger.data
                    ?.filter((l) => l.customerId === c.id)
                    .reduce((sum, l) => sum + l.debit - l.credit, 0) ??
                  0) <= 0
                  ? "Paid"
                  : dueState(
                      nextDueByCustomer.get(c.id),
                      settings.data?.reminderWarningDays ?? 3,
                      now,
                    ).status
              }
            />
          ),
        },
        {
          label: "Actions",
          render: (c) => <ReminderButton customerId={c.id} />,
        },
        {
          label: "Outstanding",
          render: (c) =>
            currency(
              c.outstanding ??
                (ledger.data ?? [])
                  .filter((l) => l.customerId === c.id)
                  .reduce((s, l) => s + l.debit - l.credit, 0),
            ),
        },
      ]}
    />
  );
}
export function CustomerFormPage() {
  const { id } = useParams();
  const isCustomer = useLocation().pathname.startsWith("/customers");
  const canCredit = usePermission("credit.create");
  const q = useRepository("customer-form-" + id, () =>
    id
      ? r.customers.get(id).then((customer) => customer ?? null)
      : Promise.resolve(null),
  );
  const a = useAction();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<string | null>(null);
  const p = q.data;
  return (
    <>
      <PageHeader
        title={
          isCustomer
            ? id
              ? "Edit Customer"
              : "Add Customer"
            : id
              ? "Edit Credit Account"
              : "Add Credit Account"
        }
        subtitle="Internal business accounts; credit limits are optional."
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        <section className="panel form-section">
          <RecordForm
            fields={customerFields.filter(
              (f) =>
                canCredit ||
                ![
                  "creditLimit",
                  "creditEnabled",
                  "dueAt",
                  "reminderEnabled",
                ].includes(f.key),
            )}
            initial={
              p
                ? {
                    name: p.name,
                    type: p.type,
                    shopName: p.shopName,
                    ownerName: p.ownerName,
                    collectingPerson: p.collectingPerson,
                    phone: p.phone,
                    whatsappSameAsPhone: p.whatsappSameAsPhone !== false,
                    whatsappNumber: p.whatsappNumber ?? "",
                    dueAt: p.dueAt ?? "",
                    reminderEnabled: p.reminderEnabled !== false,
                    address: p.address,
                    creditLimit: p.creditLimit ?? "",
                    creditEnabled: p.creditEnabled ?? p.creditLimit !== null,
                    tags: (p.tags ?? []).join(", "),
                    notes: p.notes,
                  }
                : {
                    type: "Individual",
                    creditLimit: "",
                    creditEnabled: !isCustomer,
                    whatsappSameAsPhone: true,
                    reminderEnabled: true,
                  }
            }
            busy={a.busy}
            onSubmit={(v) =>
              void a.run(
                () =>
                  r.customers.save({
                    id: id ?? crypto.randomUUID(),
                    name: text(v.name),
                    type: text(v.type) as Customer["type"],
                    shopName: text(v.shopName),
                    ownerName: text(v.ownerName),
                    collectingPerson: text(v.collectingPerson),
                    phone: text(v.phone),
                    whatsappSameAsPhone: v.whatsappSameAsPhone !== false,
                    whatsappNumber: text(v.whatsappNumber),
                    dueAt: canCredit ? text(v.dueAt) : p?.dueAt,
                    reminderEnabled: canCredit
                      ? Boolean(v.reminderEnabled)
                      : p?.reminderEnabled,
                    address: text(v.address),
                    notes: text(v.notes),
                    photo: photo ?? p?.photo ?? "",
                    photoPath: p?.photoPath,
                    creditEnabled: canCredit
                      ? Boolean(v.creditEnabled)
                      : (p?.creditEnabled ?? false),
                    tags: text(v.tags)
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    creditLimit: !canCredit
                      ? (p?.creditLimit ?? null)
                      : v.creditLimit === "" || v.creditLimit === undefined
                        ? null
                        : num(v.creditLimit),
                    createdAt: p?.createdAt ?? new Date().toISOString(),
                  }),
                "Customer saved",
                (c) =>
                  navigate((isCustomer ? "/customers/" : "/credit/") + c.id),
              )
            }
          >
            <ImageUploader
              value={photo ?? p?.photo ?? ""}
              onChange={setPhoto}
              label="Upload account photo"
            />
            <CameraCapture
              type="customer-photo"
              title="Customer Photo"
              onImage={setPhoto}
              compact
            />
          </RecordForm>
        </section>
      </QueryState>
    </>
  );
}
export function CreditDetailPage() {
  const now = useShopClock(),
    navigate = useNavigate();
  const { id = "" } = useParams();
  const isCustomer = useLocation().pathname.startsWith("/customers");
  const creditCreate = usePermission("credit.create"),
    canCredit = usePermission("credit.receive_payment") || creditCreate;
  const canSales = usePermission("sales.view"),
    canTest = usePermission("inventory.transfer"),
    canReceive = usePermission("credit.receive_payment"),
    canEdit = usePermission("customers.edit") || creditCreate,
    canCreateSale = usePermission("sales.create");
  const obligations = useRepository(
    "credit-due-" + id,
    () => r.customers.reminders?.(id) ?? Promise.resolve([]),
    canCredit || canTest,
  );
  const q = useRepository("credit-workspace-" + id, async () => {
    const [customer, ledger, methods, events] = await Promise.all([
      r.customers.get(id),
      canCredit
        ? r.credit
            .ledger(id)
            .then((rows) => rows.filter((row) => row.customerId === id))
        : Promise.resolve([]),
      canReceive
        ? r.payments
            .list()
            .then((rows) =>
              rows.filter(
                (method) => method.enabled && method.kind !== "Credit",
              ),
            )
        : Promise.resolve([]),
      allCustomerActivity(
        (filter) =>
          r.customers.timeline?.(id, filter) ??
          Promise.resolve({ rows: [], total: 0 }),
      ),
    ]);
    return { customer, ledger, methods, events };
  });
  const a = useAction(),
    [collect, setCollect] = useState(false),
    [draftConflict, setDraftConflict] = useState(false),
    [receipt, setReceipt] = useState<{ code: string; amount: number } | null>(
      null,
    );
  const customer = q.data?.customer,
    ledger = q.data?.ledger ?? [],
    balance =
      customer?.outstanding ??
      ledger.reduce((sum, row) => sum + row.debit - row.credit, 0),
    summary = ledgerSummary(ledger, q.data?.events ?? []);
  const creditObligations = (
    balance > 0 ? (obligations.data ?? []) : []
  ).filter((item) => item.kind === "credit" && (item.amount ?? 0) > 0);
  const dated = creditObligations
      .filter((item) => item.dueAt)
      .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!)),
    undated = creditObligations.filter((item) => !item.dueAt),
    nextDue = dated[0];
  const tests = (obligations.data ?? []).filter(
    (item) => item.kind === "test" && (item.quantity ?? 0) > 0,
  );
  const editHref = (isCustomer ? "/customers/" : "/credit/") + id + "/edit",
    whatsapp =
      customer?.whatsappSameAsPhone === false
        ? customer?.whatsappNumber
        : customer?.phone;
  const newSale = () => {
    const cart = useCartStore.getState();
    if ((cart.items.length || cart.sourceTestId) && cart.customerId !== id) {
      setDraftConflict(true);
      return;
    }
    useCartStore.setState({ customerId: id });
    navigate("/pos");
  };
  return (
    <>
      <PageHeader
        title={customer?.name ?? "Customer account"}
        subtitle={customer?.type ?? "Account details, obligations and history."}
        action={
          <>
            {canReceive && (
              <Button
                variant="primary"
                onClick={() => setCollect(true)}
                disabled={balance <= 0 || q.isPending}
              >
                Receive Payment
              </Button>
            )}
            {canCreateSale && <Button onClick={newSale}>New Sale</Button>}
            {whatsapp && normalizeWhatsapp(whatsapp) ? (
              <a
                className="button button-secondary"
                href={whatsappUrl(whatsapp, "")}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            ) : (
              canEdit && (
                <Link className="button button-secondary" to={editHref}>
                  Edit Number
                </Link>
              )
            )}
            {canEdit && (
              <Link className="button button-secondary" to={editHref}>
                Edit
              </Link>
            )}
          </>
        }
      />
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {customer ? (
          <section
            className="customer-account-workspace"
            aria-label="Customer account workspace"
          >
            <aside className="customer-account-sidebar">
              <section
                className="panel customer-account-card"
                aria-label="Customer contact summary"
              >
                <div className="customer-contact-heading">
                  {customer.photo ? (
                    <MediaImage
                      src={customer.photo}
                      alt={customer.name}
                      className="customer-avatar"
                    />
                  ) : (
                    <span
                      className="customer-avatar customer-avatar-initial"
                      aria-hidden="true"
                    >
                      {customer.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <h2>{customer.name}</h2>
                    <span className="text-muted text-sm">{customer.type}</span>
                  </div>
                </div>
                <dl className="customer-contact-list">
                  <div>
                    <dt>Mobile</dt>
                    <dd>{customer.phone || "Not configured"}</dd>
                  </div>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>{whatsapp || "Not configured"}</dd>
                  </div>
                  {customer.address && (
                    <div>
                      <dt>Address</dt>
                      <dd>{customer.address}</dd>
                    </div>
                  )}
                  {customer.shopName && (
                    <div>
                      <dt>Business</dt>
                      <dd>{customer.shopName}</dd>
                    </div>
                  )}
                  {customer.ownerName && (
                    <div>
                      <dt>Owner</dt>
                      <dd>{customer.ownerName}</dd>
                    </div>
                  )}
                </dl>
                <details className="customer-profile-more">
                  <summary>More account details</summary>
                  <dl className="customer-contact-list">
                    {customer.collectingPerson && (
                      <div>
                        <dt>Collecting person</dt>
                        <dd>{customer.collectingPerson}</dd>
                      </div>
                    )}
                    {customer.tags?.length ? (
                      <div>
                        <dt>Tags</dt>
                        <dd>{customer.tags.join(", ")}</dd>
                      </div>
                    ) : null}
                    {customer.notes && (
                      <div>
                        <dt>Profile notes</dt>
                        <dd>{customer.notes}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Customer ID</dt>
                      <dd>{customer.id}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{customer.status ?? "Active"}</dd>
                    </div>
                  </dl>
                  {canSales && (
                    <Link
                      to={"/transactions?customer=" + encodeURIComponent(id)}
                    >
                      All customer receipts
                    </Link>
                  )}
                </details>
              </section>
              {canCredit && (
                <section
                  className="panel customer-account-card customer-balance-card"
                  aria-label="Balance and next due"
                >
                  <h2>Balance and next due</h2>
                  <div className="customer-outstanding">
                    <span>Outstanding</span>
                    <strong>{currency(balance)}</strong>
                  </div>
                  <div className="customer-next-due">
                    <span>Next due</span>
                    <strong>
                      {balance <= 0
                        ? "Settled account"
                        : obligations.isPending
                          ? "Loading obligations…"
                          : obligations.isError
                            ? "Unable to load obligations"
                            : nextDue
                              ? obligationTiming(nextDue, now).label
                              : undated.length
                                ? "No time limit"
                                : "No outstanding deadline recorded"}
                    </strong>
                    {nextDue && (
                      <small>
                        {nextDue.reference}
                        {dated.length > 1 ? (
                          <a href="#customer-obligations">
                            {" "}
                            · {dated.length - 1} other dated obligation
                            {dated.length > 2 ? "s" : ""}
                          </a>
                        ) : null}
                      </small>
                    )}
                    {undated.length > 0 && (
                      <small>
                        {undated.length} undated obligation
                        {undated.length === 1 ? "" : "s"}
                      </small>
                    )}
                  </div>
                  <div className="summary-line">
                    <span>
                      Credit charged <small>All account history</small>
                    </span>
                    <strong>{currency(summary.charged)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Paid and adjusted</span>
                    <strong>{currency(summary.totalCredits)}</strong>
                  </div>
                  <dl className="customer-credit-breakdown">
                    <div>
                      <dt>Payments applied</dt>
                      <dd>{currency(summary.payments)}</dd>
                    </div>
                    <div>
                      <dt>Returns / debt reduction</dt>
                      <dd>{currency(summary.returns)}</dd>
                    </div>
                    <div>
                      <dt>Reversals reducing debt</dt>
                      <dd>{currency(summary.reversals)}</dd>
                    </div>
                    {summary.adjustments > 0 && (
                      <div>
                        <dt>Other adjustments</dt>
                        <dd>{currency(summary.adjustments)}</dd>
                      </div>
                    )}
                    {summary.reversedPayments > 0 && (
                      <div>
                        <dt>Reversed payments / debt restored</dt>
                        <dd>{currency(summary.reversedPayments)}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="text-muted text-xs">
                    Applied payments are separate from returned goods and debt
                    adjustments.
                  </p>
                  <div className="summary-line">
                    <span>Credit limit</span>
                    <strong>
                      {customer.creditLimit === null
                        ? "No limit"
                        : currency(customer.creditLimit)}
                    </strong>
                  </div>
                </section>
              )}
              {(canCredit || canTest) && (
                <section
                  className="panel customer-account-card"
                  aria-label="Upcoming obligations"
                  id="customer-obligations"
                >
                  <h2>Upcoming obligations</h2>
                  <QueryState
                    pending={obligations.isPending}
                    error={obligations.isError}
                    retry={() => void obligations.refetch()}
                  >
                    {creditObligations.length === 0 && (
                      <p className="text-muted">
                        {balance <= 0
                          ? "No outstanding payments."
                          : "No invoice obligations available."}
                      </p>
                    )}
                    {dated.length > 0 && (
                      <h3>Dated payments · {dated.length}</h3>
                    )}
                    {[...dated, ...undated].map((item, index) => (
                      <div key={item.id}>
                        {index === dated.length && undated.length > 0 && (
                          <h3>
                            No time limit · {undated.length} undated payment
                            {undated.length === 1 ? "" : "s"}
                          </h3>
                        )}
                        <div className="customer-obligation">
                          <strong>
                            {item.reference} · {currency(item.amount ?? 0)}
                          </strong>
                          <span>{item.description}</span>
                          <span
                            className={
                              obligationTiming(item, now).overdue
                                ? "text-danger"
                                : ""
                            }
                          >
                            {obligationTiming(item, now).label}
                          </span>
                          <small>{obligationTiming(item, now).taken}</small>
                          {item.saleId && canSales && (
                            <Link to={"/transactions/" + item.saleId}>
                              View invoice
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                    {tests.length > 0 && (
                      <h3>Test-item returns · {tests.length}</h3>
                    )}
                    {tests.map((item) => (
                      <div className="customer-obligation" key={item.id}>
                        <strong>
                          {item.description} · Qty {item.quantity}
                        </strong>
                        <span>{obligationTiming(item, now).label}</span>
                        <small>{obligationTiming(item, now).taken}</small>
                        <ReminderButton
                          customerId={id}
                          obligationId={item.id}
                          kind="test"
                          label="Review return reminder"
                        />
                      </div>
                    ))}
                  </QueryState>
                </section>
              )}
              {canCredit && !obligations.isError && !obligations.isPending && (
                <CustomerReminder
                  items={[...dated, ...undated]}
                  customerId={id}
                  editHref={canEdit ? editHref : undefined}
                  now={now}
                />
              )}
            </aside>
            <CustomerActivity
              customerId={id}
              ledger={ledger}
              outstanding={balance}
              events={q.data?.events}
              canLedger={canCredit}
            />
          </section>
        ) : (
          <EmptyState
            title="Customer unavailable"
            description="This account was not found or is unavailable to your current permissions."
          />
        )}
      </QueryState>
      <Dialog
        open={draftConflict}
        onOpenChange={setDraftConflict}
        title="An existing sale draft is open"
        description="Your cart already contains items for another customer. Choose how to continue; all current items will be preserved."
      >
        <div className="dialog-actions">
          <Button
            onClick={() => {
              setDraftConflict(false);
              navigate("/pos");
            }}
          >
            Continue existing draft
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              useCartStore.setState({ customerId: id });
              setDraftConflict(false);
              navigate("/pos");
            }}
          >
            Use this customer for existing draft
          </Button>
          <Button onClick={() => setDraftConflict(false)}>Cancel</Button>
        </div>
      </Dialog>

      <Dialog
        open={collect}
        onOpenChange={setCollect}
        title="Receive Credit Payment"
        description="This payment reduces outstanding credit and never changes stock."
      >
        {!localDemoEnabled ? (
          <CreditPaymentForm
            customerId={id}
            balance={balance}
            methods={q.data?.methods ?? []}
            onComplete={(code, amount) => {
              setCollect(false);
              setReceipt({ code, amount });
            }}
          />
        ) : (
          <RecordForm
            fields={[
              {
                key: "amount",
                label: "Amount (PKR)",
                type: "number",
                required: true,
                min: 0.01,
                max: balance,
              },
              {
                key: "method",
                label: "Payment method",
                type: "select",
                required: true,
                options: q.data?.methods.map((method) => ({
                  value: method.id,
                  label: method.name,
                })),
              },
              { key: "reference", label: "Reference" },
              { key: "notes", label: "Notes", type: "textarea" },
            ]}
            initial={{ amount: balance, method: "cash" }}
            busy={a.busy}
            submit="Receive Payment"
            onSubmit={(values) =>
              void a.run(
                () =>
                  r.credit.receive(
                    id,
                    num(values.amount),
                    text(values.method),
                    text(values.reference),
                    text(values.notes),
                  ),
                "Payment received",
                (code) => {
                  setCollect(false);
                  setReceipt({ code, amount: num(values.amount) });
                },
              )
            }
          />
        )}
      </Dialog>
      {receipt && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setReceipt(null);
          }}
          title="Payment Receipt"
          description={
            localDemoEnabled
              ? "Credit payment saved in this browser demo."
              : "Credit payment saved in the shared backend."
          }
        >
          <div className="print-area receipt-preview">
            <strong>TAHA MOBILES</strong>
            <h2>{receipt.code}</h2>
            <p>{q.data?.customer?.name}</p>
            <strong>{currency(receipt.amount)}</strong>
            <p>Payment received against outstanding credit.</p>
          </div>
          <Button onClick={() => window.print()}>Print Receipt</Button>
        </Dialog>
      )}
    </>
  );
}
