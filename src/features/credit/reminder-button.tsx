import { useState } from "react";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";
import { repositories as r } from "../../lib/repositories";
import { useAction } from "../../hooks/use-repository";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import {
  Field,
  ConfirmDialog,
  StatusBadge,
} from "../../components/ui/workspace";
import {
  reminderMessage,
  whatsappUrl,
  normalizeWhatsapp,
  dueState,
} from "../../lib/reminders";
import { shopTimestamp } from "../../lib/shop-time";
import { currency } from "../../lib/utils";
import { nativeDesktop } from "../../lib/desktop/runtime";
import type { ReminderObligation, ReminderInput } from "../../types/reminders";
import "./reminders.css";
export function ReminderButton({
  customerId,
  obligationId,
  kind = "credit",
  label = "Send WhatsApp Reminder",
}: {
  customerId: string;
  obligationId?: string;
  kind?: "credit" | "test";
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<ReminderObligation[]>([]),
    [active, setActive] = useState<ReminderObligation | null>(null),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(false),
    a = useAction();
  const snapshot = (item: ReminderObligation) => ({
    expectedAmount: item.amount,
    expectedQuantity: item.quantity,
    expectedDueAt: item.dueAt || null,
  });
  const record = (
    action: ReminderInput["action"],
    item = active,
    text = message,
  ) => {
    if (!item || !r.customers.recordReminder)
      throw new Error("Refresh this reminder before continuing.");
    return r.customers.recordReminder({
      idempotencyKey: crypto.randomUUID(),
      obligationId: item.id,
      kind: item.kind,
      action,
      message: text,
      ...snapshot(item),
    });
  };
  const prepare = async (id?: string) => {
    const available = (
        (await r.customers.reminders?.(customerId)) ?? []
      ).filter((o) => o.kind === kind && o.reminderEnabled),
      item =
        available.find((o) => o.id === id) ??
        (available.length === 1 ? available[0] : undefined);
    if (!available.length)
      throw new Error(
        "No enabled reminder is available. Check the balance and Credit reminder settings.",
      );
    if (id && !item)
      throw new Error(
        "This item is settled or no longer available. Refresh the account.",
      );
    if (item) {
      const text = reminderMessage(item);
      await record("prepared", item, text);
      return { available, item, text };
    }
    return { available, item: null, text: "" };
  };
  const begin = (id?: string) =>
    void a.run(
      () => prepare(id),
      "Reminder details refreshed",
      (result) => {
        setItems(result.available);
        setActive(result.item);
        setMessage(result.text);
      },
    );
  const openWhatsapp = () => {
    if (!active) return;
    let target: string;
    try {
      target = whatsappUrl(active.whatsappNumber, message);
    } catch {
      void a.run(async () => {
        throw new Error("Add a valid WhatsApp number in Edit Account first.");
      }, "");
      return;
    }
    const popup = nativeDesktop ? null : window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    void a.run(async () => {
      try {
        if (!nativeDesktop && !popup)
          throw new Error(
            "Your browser blocked the window. Allow it or copy the message.",
          );
        await record("whatsapp-opened");
        if (nativeDesktop) {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(target);
        } else popup!.location.replace(target);
      } catch (error) {
        popup?.close();
        throw error;
      }
    }, "WhatsApp opened. Press Send there when ready.");
  };
  return (
    <>
      <Button
        size="small"
        onClick={() => {
          setOpen(true);
          setActive(null);
          setItems([]);
          begin(obligationId);
        }}
      >
        <MessageCircle size={15} />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!a.busy) setOpen(value);
        }}
        title="Send WhatsApp Reminder"
        description="Review the current details and message. You send it manually in WhatsApp."
      >
        {a.busy && !active && (
          <p role="status">Checking the latest balance and due date…</p>
        )}
        {!active &&
          items.map((item) => (
            <button
              className="reminder-choice"
              key={item.id}
              onClick={() => begin(item.id)}
            >
              <strong>{item.reference}</strong>
              <span>{item.description}</span>
              <strong>
                {item.kind === "credit"
                  ? currency(item.amount ?? 0)
                  : "Qty " + item.quantity}
              </strong>
            </button>
          ))}
        {active && (
          <>
            <div className="reminder-summary">
              <div>
                <strong>{active.customerName}</strong>
                <small>{active.reference}</small>
                <small>
                  {normalizeWhatsapp(active.whatsappNumber) ||
                    "WhatsApp number not configured"}
                </small>
              </div>
              <div>
                <strong>
                  {active.kind === "credit"
                    ? currency(active.amount ?? 0)
                    : "Quantity " + active.quantity}
                </strong>
                <StatusBadge status={dueState(active.dueAt).status} />
              </div>
            </div>
            <p className="text-muted text-sm">
              {active.dueAt
                ? "Due: " + shopTimestamp(active.dueAt)
                : "No due date configured"}
            </p>
            <Field label="Message">
              <textarea
                className="input reminder-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
              />
            </Field>
            <div className="dialog-actions reminder-actions">
              <Button disabled={a.busy} onClick={() => begin(active.id)}>
                <RefreshCw size={15} />
                Refresh Details
              </Button>
              <Button
                disabled={a.busy || !message.trim()}
                onClick={() =>
                  void a.run(
                    () => navigator.clipboard.writeText(message),
                    "Message copied. Nothing was sent.",
                  )
                }
              >
                <Copy size={15} />
                Copy Message
              </Button>
              <Button
                variant="primary"
                disabled={
                  a.busy ||
                  !message.trim() ||
                  !normalizeWhatsapp(active.whatsappNumber)
                }
                onClick={openWhatsapp}
              >
                <MessageCircle size={15} />
                Open WhatsApp
              </Button>
            </div>
            <Button
              size="small"
              disabled={a.busy}
              onClick={() => setConfirm(true)}
            >
              Mark Manually Contacted
            </Button>
            <p className="text-xs text-muted">
              Opening WhatsApp does not confirm sending or delivery. Contact
              status is recorded only when you confirm it.
            </p>
          </>
        )}
        {a.error && (
          <p role="alert" className="form-error">
            {a.error}
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirm}
        title="Mark manually contacted?"
        description="Confirm only if you contacted this customer yourself. This does not mark a WhatsApp message as sent or delivered."
        confirm="Mark Contacted"
        busy={a.busy}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          void a.run(
            () => record("contacted"),
            "Manual contact recorded",
            () => setConfirm(false),
          )
        }
      />
    </>
  );
}
