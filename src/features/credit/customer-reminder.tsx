import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, MessageCircle } from "lucide-react";
import { repositories as r } from "../../lib/repositories";
import { useAction } from "../../hooks/use-repository";
import type { ReminderObligation } from "../../types/reminders";
import {
  reminderMessage,
  normalizeWhatsapp,
  whatsappUrl,
} from "../../lib/reminders";
import { currency } from "../../lib/utils";
import { nativeDesktop } from "../../lib/desktop/runtime";
import {useCopyText} from "../../components/ui/copy-text";
import {prepareExternalWindow,openWhatsappDestination} from "../../lib/external-actions";
import { Button } from "../../components/ui/button";
import { AppSelect } from "../../components/ui/app-select";
import { obligationTiming } from "./customer-account";
export function CustomerReminder({
  items,
  customerId,
  editHref,
  now,
}: {
  items: ReminderObligation[];
  customerId: string;
  editHref?: string;
  now: number;
}) {
  const clipboard=useCopyText();
  const [choice, setChoice] = useState(""),
    [draft, setDraft] = useState<{
      id: string;
      message: string;
      source: string;
    } | null>(null),
    a = useAction();
  const active = items.find((item) => item.id === choice) ?? items[0];
  const source = active
    ? reminderMessage(active, now)
        .replace("Payment Due: Not configured", "Payment Due: No time limit")
        .replace("Purchased:", "Taken on:")
    : "";
  const message =
    draft && active && draft.id === active.id && draft.source === source
      ? draft.message
      : source;
  const record = async (
    action: "prepared" | "whatsapp-opened",
    item: ReminderObligation,
  ) => {
    if (!r.customers.recordReminder)
      throw new Error(
        "Reminder recording is unavailable. Please refresh the account.",
      );
    return r.customers.recordReminder({
      idempotencyKey: crypto.randomUUID(),
      obligationId: item.id,
      kind: "credit",
      action,
      message,
      expectedAmount: item.amount,
      expectedDueAt: item.dueAt || null,
    });
  };
  async function latest() {
    const refreshed = await r.customers.reminders?.(customerId),
      item = refreshed?.find(
        (item) => item.id === active?.id && item.kind === "credit",
      );
    if (!item || !item.reminderEnabled || (item.amount ?? 0) <= 0)
      throw new Error(
        "This obligation is settled or reminders are disabled. Refresh the account.",
      );
    if (
      item.amount !== active?.amount ||
      item.dueAt !== active?.dueAt ||
      item.whatsappNumber !== active?.whatsappNumber
    )
      throw new Error(
        "Account details changed. Refresh and review the updated reminder before continuing.",
      );
    return item;
  }
  return (
    <section
      className="panel customer-account-card customer-reminder"
      aria-label="Payment reminder"
    >
      <h2>Payment reminder</h2>
      {active ? (
        <>
          {items.length > 1 && (
            <label className="form-field">
              <span>Outstanding invoice</span>
              <AppSelect
                className="input"
                value={active.id}
                onChange={(e) => setChoice(e.target.value)}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reference} · {currency(item.amount ?? 0)}
                  </option>
                ))}
              </AppSelect>
            </label>
          )}
          <strong>
            {currency(active.amount ?? 0)} · {active.reference}
          </strong>
          <p>{obligationTiming(active, now).label}</p>
          <small>{obligationTiming(active, now).taken}</small>
          <label className="form-field">
            <span>Prepared message</span>
            <textarea
              className="input"
              value={message}
              onChange={(e) =>
                setDraft({ id: active.id, message: e.target.value, source })
              }
              rows={11}
              maxLength={4000}
            />
          </label>
          {!normalizeWhatsapp(active.whatsappNumber) && (
            <p className="form-error">
              A valid WhatsApp number is required.{" "}
              {editHref && <Link to={editHref}>Edit Number</Link>} You can copy
              the message.
            </p>
          )}
          {!active.reminderEnabled && (
            <p className="text-muted">
              Manual reminders are disabled for this account or shop.{" "}
              {editHref && <Link to={editHref}>Edit Account</Link>}
            </p>
          )}
          <div className="customer-card-actions">
            <Button
              size="small"
              disabled={a.busy || !message.trim() || !active.reminderEnabled}
              onClick={() =>
                void a.run(async () => {
                  const item = await latest();
                  if(!await clipboard.copy(message))throw new Error('Automatic copy is unavailable. Copy the selected text shown.');
                  await record("prepared", item);
                }, "Message copied. Nothing was sent.")
              }
            >
              <Copy size={14} />
              Copy Message
            </Button>
            <Button
              size="small"
              disabled={
                a.busy ||
                !message.trim() ||
                !normalizeWhatsapp(active.whatsappNumber) ||
                !active.reminderEnabled
              }
              onClick={() => {
                const popup = prepareExternalWindow();
                void a.run(async () => {
                  try {
                    const item = await latest();
                    const target = whatsappUrl(item.whatsappNumber, message);
                    if (!nativeDesktop && !popup)
                      throw new Error(
                        "The browser blocked WhatsApp. Allow a new window or copy the message.",
                      );
                    await record("prepared", item);
                    await openWhatsappDestination(target,popup);
                    await record("whatsapp-opened", item);
                  } catch (error) {
                    popup?.close();
                    throw error;
                  }
                }, "WhatsApp opened. Send the message there when ready.");
              }}
            >
              <MessageCircle size={14} />
              Open WhatsApp
            </Button>
          </div>
          <p className="text-muted text-xs">
            Prepared/opened only. Opening WhatsApp does not confirm sending or
            delivery. Test-item return reminders are separate.
          </p>
          {a.error && (
            <p role="alert" className="form-error">
              {a.error}
            </p>
          )}
        </>
      ) : (
        <p className="text-muted">
          No outstanding payment obligation to remind. Settled invoices do not
          create reminders.
        </p>
      )}
      {clipboard.fallback}
    </section>
  );
}
