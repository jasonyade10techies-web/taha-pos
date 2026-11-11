import type {
  ReminderObligation,
  ReminderInput,
  ReminderHistory,
  ReminderAlert,
} from "../../types/reminders";
import { demoDb, atomic, newId, requireValue, money } from "./database";
import { actor, allowed, audit } from "./common";
import { dueState, normalizeWhatsapp } from "../reminders";
export async function reminderObligations(
  customerId?: string,
): Promise<ReminderObligation[]> {
  const credit = allowed("credit.create") || allowed("credit.receive_payment"),
    tests = allowed("inventory.transfer");
  requireValue(
    credit || tests,
    "You do not have permission to prepare customer reminders.",
  );
  const settings = await demoDb.settings.get("main"),
    customers = (await demoDb.customers.toArray()).filter(
      (c) => !customerId || c.id === customerId,
    ),
    rows: ReminderObligation[] = [];
  for (const customer of customers) {
    const contact = {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      whatsappNumber:
        customer.whatsappSameAsPhone !== false
          ? customer.phone
          : (customer.whatsappNumber ?? ""),
      reminderEnabled:
        settings?.remindersEnabled === true &&
        customer.reminderEnabled !== false,
    };
    if (credit) {
      const sales = await demoDb.sales
          .where("customerId")
          .equals(customer.id)
          .toArray(),
        ledger = await demoDb.ledger
          .where("customerId")
          .equals(customer.id)
          .toArray(),
        balance = money(ledger.reduce((sum, l) => sum + l.debit - l.credit, 0));
      const debts = sales
        .filter((s) => s.status !== "Voided")
        .map((sale) => ({
          sale,
          amount: money(
            ledger
              .filter(
                (l) =>
                  l.saleId === sale.id ||
                  (!l.saleId && l.reference === sale.invoice),
              )
              .reduce((sum, l) => sum + l.debit - l.credit, 0),
          ),
        }))
        .filter((d) => d.amount > 0);
      if (
        balance > 0 &&
        Math.abs(debts.reduce((sum, d) => sum + d.amount, 0) - balance) > 0.01
      )
        rows.push({
          ...contact,
          id: "credit-account:" + customer.id,
          kind: "credit",
          reference: "Account balance",
          description:
            "Account balance · historical payments are not fully linked to invoices",
          occurredAt: customer.createdAt,
          dueAt: customer.dueAt,
          amount: balance,
        });
      else
        for (const { sale, amount } of debts)
          rows.push({
            ...contact,
            id: "credit:" + sale.id,
            kind: "credit",
            reference: sale.invoice,
            description: sale.lines.map((l) => l.name).join(", "),
            occurredAt: sale.createdAt,
            dueAt: sale.creditDueAt ?? customer.dueAt,
            amount,
            saleId: sale.id,
          });
    }
    if (tests)
      for (const test of await demoDb.testOuts
        .where("customerId")
        .equals(customer.id)
        .toArray()) {
        if (test.status !== "OUT") continue;
        const product = await demoDb.products.get(test.productId);
        rows.push({
          ...contact,
          id: "test:" + test.id,
          kind: "test",
          reference: test.code,
          description: product?.name ?? "Test item",
          occurredAt: test.takenDate,
          dueAt: test.dueDate,
          quantity: test.quantity,
          testId: test.id,
        });
      }
  }
  return rows.sort(
    (a, b) =>
      (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") ||
      a.id.localeCompare(b.id),
  );
}
export async function recordReminder(
  input: ReminderInput,
): Promise<ReminderHistory> {
  return atomic(async () => {
    requireValue(
      ["prepared", "whatsapp-opened", "contacted"].includes(input.action) &&
        input.idempotencyKey,
      "Choose a manual reminder action.",
    );
    const current = (await reminderObligations()).find(
      (o) => o.id === input.obligationId && o.kind === input.kind,
    );
    requireValue(
      current,
      "This obligation is settled or no longer available. Refresh the account.",
    );
    requireValue(
      current.reminderEnabled,
      "Enable reminders in Credit settings and for this account first.",
    );
    const previous = await demoDb.reminderHistory
      .where("idempotencyKey")
      .equals(input.idempotencyKey)
      .first();
    if (previous) {
      requireValue(
        (['obligationId','kind','action','message','expectedAmount','expectedQuantity','expectedDueAt'] as const).every(key=>(previous[key]??null)===(input[key]??null)),
        "This reminder request was already used for different values.",
      );
      return previous;
    }
    requireValue(
      input.expectedAmount === undefined ||
        input.expectedAmount === current.amount,
      "The outstanding balance changed. Refresh the reminder before continuing.",
    );
    requireValue(
      input.expectedQuantity === undefined ||
        input.expectedQuantity === current.quantity,
      "The item quantity changed. Refresh the reminder.",
    );
    requireValue(
      input.expectedDueAt === undefined ||
        (input.expectedDueAt ?? null) === (current.dueAt ?? null),
      "The deadline changed. Refresh the reminder.",
    );
    requireValue(
      !input.message || input.message.length <= 4000,
      "Keep reminder messages under 4,000 characters.",
    );
    if (input.action === "whatsapp-opened")
      requireValue(
        normalizeWhatsapp(current.whatsappNumber),
        "Add a valid WhatsApp number first.",
      );
    const employee = actor(),
      entry = {
        ...input,
        id: newId(),
        customerId: current.customerId,
        employeeId: employee.id,
        employeeName: employee.name,
        createdAt: new Date().toISOString(),
      };
    await demoDb.reminderHistory.add(entry);
    await audit(
      "reminder." + input.action,
      "Credit",
      "Manual " + current.kind + " reminder: " + input.action,
      current.id,
    );
    return entry;
  });
}
export async function reminderAlerts(): Promise<ReminderAlert[]> {
  const settings = await demoDb.settings.get("main");
  if (!settings?.remindersEnabled) return [];
  return (await reminderObligations())
    .filter(
      (o) =>
        o.reminderEnabled &&
        o.dueAt &&
        dueState(o.dueAt, settings.reminderWarningDays ?? 3).status !==
          "Current",
    )
    .map((o) => ({
      id:
        "due:" +
        o.id +
        ":" +
        o.dueAt +
        ":" +
        dueState(o.dueAt, settings.reminderWarningDays ?? 3).status,
      customerId: o.customerId,
      kind: o.kind,
      title:
        (o.kind === "credit" ? "Credit" : "Out-for-Test") +
        " · " +
        dueState(o.dueAt, settings.reminderWarningDays ?? 3).label,
      description: o.customerName + " · " + o.reference,
      href: o.kind === "credit" ? "/credit/" + o.customerId : "/out-for-test",
      dueAt: o.dueAt,
    }));
}
