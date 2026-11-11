import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  Clock3,
  MessageSquareText,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { usePermission } from "../../hooks/use-permission";
import { useShopConfiguration } from "../../hooks/use-shop-configuration";
import type { Ledger } from "../../types/demo";
import type { CustomerActivity as Activity } from "../../types/customer-activity";
import { shopDay, shopTimestamp } from "../../lib/shop-time";
import { currency } from "../../lib/utils";
import {
  Tabs,
  QueryState,
  EmptyState,
  Field,
  DataTable,
} from "../../components/ui/workspace";
import { DatePicker } from "../../components/ui/date-picker";
import { Button } from "../../components/ui/button";
import { AppSelect } from "../../components/ui/app-select";
import { CustomerEventDetail } from "./customer-event-detail";
import {
  allCustomerActivity,
  historyFilters,
  historyCategory,
  historyTitle,
  amountDirection,
  customerLedger,
  ledgerKind,
  type HistoryFilter,
} from "./customer-account";
import "./customer-activity.css";
export function CustomerActivity({
  customerId,
  returnsOnly = false,
  ledger = [],
  outstanding = 0,
  events: provided,
  canLedger = false,
}: {
  customerId: string;
  returnsOnly?: boolean;
  ledger?: Ledger[];
  outstanding?: number;
  events?: Activity[];
  canLedger?: boolean;
}) {
  const [category, setCategory] = useState<HistoryFilter>(
      returnsOnly ? "Returns" : "All",
    ),
    [view, setView] = useState("Timeline"),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [order, setOrder] = useState<"newest" | "oldest">("newest"),
    [offset, setOffset] = useState(0),
    [note, setNote] = useState(""),
    [noteId, setNoteId] = useState(() => crypto.randomUUID()),
    [selected, setSelected] = useState<Activity | null>(null);
  const canNote = usePermission("customers.edit"),
    canSales = usePermission("sales.view"),
    a = useAction(),
    { ownerOnly } = useShopConfiguration();
  const q = useRepository(
    "customer-history-all-" + customerId,
    () =>
      allCustomerActivity(
        (filter) =>
          r.customers.timeline?.(customerId, filter) ??
          Promise.resolve({ rows: [], total: 0 }),
      ),
    !provided,
  );
  const events = provided ?? q.data ?? [],
    invalidRange = !!from && !!to && from > to;
  const timeline = events.filter((event) => {
    if (event.entityType !== "ledger") return true;
    // The corresponding purchase/payment/return already presents the same event.
    // Ledger mode retains every separate financial entry.
    return !events.some(
      (other) =>
        other.entityType !== "ledger" &&
        (other.reference === event.reference ||
          (event.type === "credit" &&
            event.saleId &&
            other.type === "sale" &&
            other.saleId === event.saleId)),
    );
  });
  const matches = (
    row: { createdAt: string; reference: string; description: string },
    filter: HistoryFilter,
  ) =>
    !invalidRange &&
    (category === "All" || category === filter) &&
    (!from || shopDay(row.createdAt) >= from) &&
    (!to || shopDay(row.createdAt) <= to) &&
    (!search ||
      `${row.reference} ${row.description}`
        .toLowerCase()
        .includes(search.toLowerCase()));
  const filtered = timeline
    .filter((event) =>
      matches(
        {
          ...event,
          description: event.description + " " + historyTitle(event),
        },
        historyCategory(event),
      ),
    )
    .sort(
      (a, b) =>
        (a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) *
        (order === "oldest" ? 1 : -1),
    );
  const ledgerRows = customerLedger(ledger, outstanding)
    .filter((row) => {
      const kind = ledgerKind(row, events),
        filter: HistoryFilter =
          kind === "charge"
            ? "Purchases"
            : kind === "return"
              ? "Returns"
              : "Payments";
      return matches(row, filter);
    })
    .sort(
      (a, b) =>
        (a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) *
        (order === "oldest" ? 1 : -1),
    );
  const total = view === "Ledger" ? ledgerRows.length : filtered.length;
  function reset() {
    setOffset(0);
  }
  function ledgerEvent(row: Ledger) {
    return (
      events.find(
        (event) => event.entityType === "ledger" && event.entityId === row.id,
      ) ?? {
        id: "credit:" + row.id,
        type: row.debit ? "credit" : "credit-adjustment",
        title: row.description,
        category: "Credit" as const,
        createdAt: row.createdAt,
        employeeId: row.employeeId,
        employeeName: "",
        reference: row.reference,
        entityType: "ledger",
        entityId: row.id,
        saleId: row.saleId,
        description: row.description,
        amount: row.debit || row.credit,
      }
    );
  }
  return (
    <section
      className="panel customer-history-panel"
      aria-label="Account history"
    >
      <div className="customer-history-heading">
        <div>
          <h2>Account history</h2>
          <p>Purchases, payments, returns and internal notes.</p>
        </div>
        {canLedger && (
          <Tabs
            items={["Timeline", "Ledger"]}
            value={view}
            onChange={(value) => {
              setView(value);
              reset();
            }}
          />
        )}
        {!canLedger && (
          <Tabs items={["Timeline"]} value="Timeline" onChange={() => {}} />
        )}
      </div>
      <Tabs
        items={historyFilters}
        value={category}
        onChange={(value) => {
          setCategory(value as HistoryFilter);
          reset();
        }}
      />
      {category==='Purchases'&&canSales&&<Link className="button button-secondary" to={'/transactions?'+new URLSearchParams({customer:customerId})}>View All Receipts</Link>}
      <div className="activity-filters">
        <Field label="Search history">
          <input
            className="input"
            type="search"
            placeholder="Invoice, item or note"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
          />
        </Field>
        <DatePicker
          label="From date"
          value={from}
          onChange={(value) => {
            setFrom(value);
            reset();
          }}
          max={to || undefined}
        />
        <DatePicker
          label="To date"
          value={to}
          onChange={(value) => {
            setTo(value);
            reset();
          }}
          min={from || undefined}
        />
        <Field label="Order">
          <AppSelect
            className="input"
            value={order}
            onChange={(e) => {
              setOrder(e.target.value as typeof order);
              reset();
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </AppSelect>
        </Field>
      </div>
      {invalidRange && (
        <p role="alert" className="form-error">
          Choose an end date on or after the start date.
        </p>
      )}
      <QueryState
        pending={!provided && q.isPending}
        error={!provided && q.isError}
        retry={() => void q.refetch()}
      >
        {view === "Ledger" ? (
          <>
            <p className="customer-ledger-help">
              Charged increases the amount owed. Paid / adjusted reduces it; a
              return adjustment is not cash received. Balance includes all
              earlier entries, even when filtered.
            </p>
            <DataTable
              rows={ledgerRows.slice(offset, offset + 30)}
              pageSize={30}
              serverPagination={{
                page: Math.floor(offset / 30),
                total: ledgerRows.length,
                onPage: (page) => setOffset(page * 30),
              }}
              onRow={(row) => setSelected(ledgerEvent(row))}
              columns={[
                {
                  label: "Reference",
                  render: (row) =>
                    row.saleId ? (
                      <Link
                        onClick={(e) => e.stopPropagation()}
                        to={"/transactions/" + row.saleId}
                      >
                        {row.reference}
                      </Link>
                    ) : (
                      row.reference
                    ),
                },
                {
                  label: "Description",
                  render: (row) => (
                    <>
                      {row.description}
                      <small className="customer-ledger-kind">
                        {ledgerKind(row, events)}
                      </small>
                    </>
                  ),
                },
                {
                  label: "Charged",
                  render: (row) => (row.debit ? currency(row.debit) : "—"),
                },
                {
                  label: "Paid / adjusted",
                  render: (row) => (row.credit ? currency(row.credit) : "—"),
                },
                { label: "Balance", render: (row) => currency(row.balance) },
                {
                  label: "Recorded",
                  render: (row) => shopTimestamp(row.createdAt),
                },
              ]}
            />
          </>
        ) : filtered.length ? (
          <ol className="activity-timeline">
            {filtered.slice(offset, offset + 30).map((event) => {
              const Icon =
                event.category === "Notes"
                  ? MessageSquareText
                  : event.category === "Payments"
                    ? ArrowDownLeft
                    : event.category === "Returns"
                      ? RotateCcw
                      : Receipt;
              return (
                <li key={event.id}>
                  <button
                    className="activity-entry"
                    onClick={() => setSelected(event)}
                  >
                    <span
                      className={
                        "activity-icon category-" +
                        historyCategory(event)
                          .toLowerCase()
                          .replaceAll(" ", "-")
                      }
                    >
                      <Icon size={17} />
                    </span>
                    <span className="activity-entry-body">
                      <span className="activity-heading">
                        <strong>{historyTitle(event)}</strong>
                        {event.amount !== undefined && (
                          <strong className="tabular-nums">
                            {currency(event.amount)}{" "}
                            <small>{amountDirection(event)}</small>
                          </strong>
                        )}
                      </span>
                      <span className="activity-description">
                        {event.description}
                      </span>
                      <span className="activity-metadata">
                        <time dateTime={event.createdAt}>
                          <Clock3 size={12} />
                          {shopTimestamp(event.createdAt)}
                        </time>
                        {!ownerOnly &&
                          event.employeeName &&
                          event.employeeName !== "Staff member" && (
                            <span>{event.employeeName}</span>
                          )}
                        <span>{event.reference}</span>
                        {event.quantity !== undefined && (
                          <span>
                            Qty {event.quantity}
                            {event.condition ? " · " + event.condition : ""}
                          </span>
                        )}
                        {event.balance !== undefined && (
                          <span>
                            Account balance: {currency(event.balance)}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState
            title="No account entries match"
            description="Change the filters or record a purchase, payment or internal note."
          />
        )}
        {view !== "Ledger" && (
          <div className="activity-pagination">
            <small>
              {total} {view === "Ledger" ? "ledger entries" : "events"}
              {total > 0
                ? ` · ${offset + 1}–${Math.min(offset + 30, total)}`
                : ""}
            </small>
            <Button
              size="small"
              disabled={!offset}
              onClick={() => setOffset((old) => Math.max(0, old - 30))}
            >
              Previous
            </Button>
            <Button
              size="small"
              disabled={offset + 30 >= total}
              onClick={() => setOffset((old) => old + 30)}
            >
              Next
            </Button>
          </div>
        )}
      </QueryState>
      {canNote && !returnsOnly && (
        <details className="activity-note-disclosure">
          <summary>Add internal note</summary>
          <form
            className="activity-note"
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(
                () =>
                  r.customers.addNote!(customerId, {
                    idempotencyKey: noteId,
                    text: note,
                  }),
                "Internal note recorded",
                () => {
                  setNote("");
                  setNoteId(crypto.randomUUID());
                },
              );
            }}
          >
            <Field
              label="Internal note"
              help="Stored on this account; this does not send a customer message."
            >
              <textarea
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                maxLength={2000}
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              disabled={a.busy || !note.trim()}
            >
              Add Note
            </Button>
            {a.error && <p role="alert">{a.error}</p>}
          </form>
        </details>
      )}
      <CustomerEventDetail
        customerId={customerId}
        event={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
