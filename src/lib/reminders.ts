import type { ReminderObligation } from "../types/reminders";
import { shopDay, shopTimestamp } from "./shop-time";
import { currency } from "./utils";
export function normalizeWhatsapp(value: string) {
  if(!/^(?:\+|00)?[\d\s().-]+$/.test(value.trim()))return '';
  let digits = value.replace(/\D/g, "").replace(/^00/, "");
  if (/^03\d{9}$/.test(digits)) digits = "92" + digits.slice(1);
  else if (/^3\d{9}$/.test(digits)) digits = "92" + digits;
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : "";
}
export function whatsappUrl(phone: string, message: string) {
  const number = normalizeWhatsapp(phone);
  if (!number)
    throw new Error("Add a valid WhatsApp number before opening the reminder.");
  return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
}
export function dueState(
  dueAt?: string,
  warningDays = 3,
  now = Date.now(),
): { status: "Current" | "Due Soon" | "Due Today" | "Overdue"; label: string } {
  if (!dueAt || !Number.isFinite(Date.parse(dueAt)))
    return { status: "Current", label: "No due date" };
  const today = shopDay(now),
    dueDay = shopDay(dueAt),
    days = Math.round((Date.parse(dueDay) - Date.parse(today)) / 86400000);
  const past =
    days < 0 || (days === 0 && dueAt.length > 10 && Date.parse(dueAt) < now);
  if (past)
    return {
      status: "Overdue",
      label:
        days === 0
          ? "Overdue today"
          : "Overdue by " + Math.abs(days) + " day" + (days === -1 ? "" : "s"),
    };
  if (days === 0) return { status: "Due Today", label: "Due today" };
  return {
    status: days <= warningDays ? "Due Soon" : "Current",
    label: days === 1 ? "Due tomorrow" : "Due in " + days + " days",
  };
}
export function reminderMessage(item: ReminderObligation, now = Date.now()) {
  const dates = [
    item.kind === "credit" ? "Purchased: " : "Taken On: ",
    shopTimestamp(item.occurredAt),
  ].join("");
  if (item.kind === "test")
    return [
      "TAHA MOBILES — Item Return Reminder",
      "",
      "Hello " + item.customerName + ",",
      "",
      "Item: " + item.description,
      "Quantity: " + item.quantity,
      "Reference: " + item.reference,
      dates,
      item.dueAt
        ? "Return Due: " + shopTimestamp(item.dueAt)
        : "Return Due: Not configured",
      "",
      "Please return the item or contact Taha Mobiles to arrange its purchase.",
      "",
      "Thank you,",
      "Taha Mobiles",
    ].join("\n");
  const state = dueState(item.dueAt, 3, now);
  return [
    "TAHA MOBILES — Payment Reminder",
    "",
    "Hello " + item.customerName + ",",
    "",
    "Our records show the following outstanding payment:",
    "",
    (item.saleId?'Invoice: ':'Reference: ') + item.reference,
    "Item/Service: " + (item.description.length>600?item.description.slice(0,600)+'…':item.description),
    dates,
    item.dueAt
      ? "Payment Due: " + shopTimestamp(item.dueAt)
      : "Payment Due: Not configured",
    "Outstanding Amount: " + currency(item.amount ?? 0),
    ...(state.status === "Overdue" ? ["", state.label + "."] : []),
    "",
    item.dueAt?"Please arrange payment by the due date or contact Taha Mobiles if you have already paid.":"Please arrange payment or contact Taha Mobiles if you have already paid.",
    "",
    "Thank you,",
    "Taha Mobiles",
  ].join("\n");
}
