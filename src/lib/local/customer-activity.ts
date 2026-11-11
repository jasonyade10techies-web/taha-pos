import type {
  ActivityFilter,
  ActivityPage,
  CustomerActivity,
} from "../../types/customer-activity";
import { demoDb, atomic, newId, requireValue, money } from "./database";
import { allowed, authorize, actor, audit } from "./common";
import { shopDay } from "../shop-time";

export async function customerTimeline(
  customerId: string,
  filter: ActivityFilter = {},
): Promise<ActivityPage> {
  requireValue(
    allowed("customers.view") ||
      allowed("customers.edit") ||
      allowed("credit.create") ||
      allowed("credit.receive_payment"),
    "You do not have permission to view this customer.",
  );
  requireValue(await demoDb.customers.get(customerId), "Customer not found.");
  const credit = allowed("credit.create") || allowed("credit.receive_payment"),
    salesAccess = allowed("sales.view"),
    returnsAccess =
      salesAccess || allowed("returns.create") || allowed("reports.view"),
    paymentsAccess=credit||allowed('payments.approve_electronic')||allowed('payments.reverse')||allowed('reports.view'),
    testsAccess = allowed("inventory.transfer");
  const [sales, ledger, payments, returns, tests, notes, employees, history] =
    await Promise.all([
      demoDb.sales.where("customerId").equals(customerId).toArray(),
      credit
        ? demoDb.ledger.where("customerId").equals(customerId).toArray()
        : [],
      demoDb.payments.where("customerId").equals(customerId).toArray(),
      returnsAccess ? demoDb.returns.toArray() : [],
      testsAccess
        ? demoDb.testOuts.where("customerId").equals(customerId).toArray()
        : [],
      demoDb.customerNotes.where("customerId").equals(customerId).toArray(),
      demoDb.employees.toArray(),
      testsAccess || salesAccess ? demoDb.audit.toArray() : [],
    ]);
  const rows: CustomerActivity[] = [],
    name = (id: string) =>
      employees.find((e) => e.id === id)?.full_name ?? "Staff member";
  ledger.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  let running = 0;
  const balances = new Map<string, number>();
  for (const entry of ledger) {
    running = money(running + entry.debit - entry.credit);
    balances.set(entry.id, running);
  }
  if (salesAccess)
    for (const sale of sales)
      rows.push({
        id: "sale:" + sale.id,
        type: "sale",
        title:
          sale.status === "Voided"
            ? "Sale Completed · Later Voided"
            : "Sale Completed",
        category: "Sales",
        createdAt: sale.createdAt,
        employeeId: sale.employeeId,
        employeeName: sale.employeeName,
        reference: sale.invoice,
        entityType: "sale",
        entityId: sale.id,
        saleId: sale.id,
        description: sale.lines
          .map((l) => l.quantity + " × " + l.name)
          .join(", "),
        amount: sale.total,
      });
  if(salesAccess)for(const entry of history.filter(e=>e.action==='sale.voided')) {
    const sale=sales.find(s=>s.invoice===entry.reference);if(!sale)continue;
    rows.push({id:'void:'+sale.id,type:'void',title:'Sale Voided',category:'Sales',createdAt:entry.createdAt,employeeId:entry.employeeId,employeeName:entry.employeeName,reference:sale.invoice,entityType:'sale',entityId:sale.id,saleId:sale.id,description:entry.description,amount:sale.total});
  }
  if (credit)
    for (const entry of ledger) {
      const sale = sales.find((s) => s.invoice === entry.reference);
      rows.push({
        id: "credit:" + entry.id,
        type: entry.debit > 0 ? "credit" : "credit-adjustment",
        title:
          entry.debit > 0
            ? "Credit Given"
            : /return/i.test(entry.description)
              ? "Return Credit Reversal"
              : /void|revers/i.test(entry.description)
                ? "Credit Reversal"
                : "Credit Payment Applied",
        category: "Credit",
        createdAt: entry.createdAt,
        employeeId: entry.employeeId,
        employeeName: name(entry.employeeId),
        reference: entry.reference,
        entityType: "ledger",
        entityId: entry.id,
        saleId: sale?.id,
        description: entry.description,
        amount: entry.debit || entry.credit,
        balance: balances.get(entry.id),
      });
    }
  for (const payment of payments) {
    if (
      payment.status === "Pending" ||
      payment.status === "Rejected" ||
      payment.kind === "sale" ||
      (payment.kind === "collection" && !credit) ||
      (payment.kind !== "collection" && !paymentsAccess)
    )
      continue;
    const sale = sales.find((s) => s.id === payment.saleId);
    const entry = ledger.filter((l) => l.reference === payment.code).at(-1);
    rows.push({
      id: "payment:" + payment.id,
      type: payment.kind === "collection" ? "payment" : payment.kind === "refund" && payment.methodId === "credit" ? "debt-adjustment" : payment.kind,
      title:
        payment.kind === "collection"
          ? "Payment Received"
          : payment.kind === "refund"
            ? payment.methodId === "credit" ? "Return debt adjustment" : "Refund Recorded"
            : "Payment Reversal",
      category: payment.kind === "refund" && payment.methodId === "credit" ? "Returns" : "Payments",
      createdAt: payment.createdAt,
      employeeId: payment.employeeId,
      employeeName: name(payment.employeeId),
      reference: payment.code,
      entityType: "payment",
      entityId: payment.id,
      saleId: sale?.id,
      description: [payment.methodName ?? payment.methodId, payment.notes]
        .filter(Boolean)
        .join(" · "),
      amount: payment.amount,
      ...(credit && entry ? { balance: balances.get(entry.id) } : {}),
    });
  }
  if (returnsAccess)
    for (const returned of returns) {
      const sale = sales.find((s) => s.id === returned.saleId);
      if (!sale) continue;
      const line = sale.lines.find((l) => l.productId === returned.productId);
      rows.push({
        id: "return:" + returned.id,
        type: "return",
        title: "Product Returned",
        category: "Returns",
        createdAt: returned.createdAt,
        employeeId: returned.employeeId,
        employeeName: name(returned.employeeId),
        reference: returned.code,
        entityType: "return",
        entityId: returned.id,
        saleId: sale.id,
        description: (line?.name ?? "Invoice item") + " · " + returned.reason,
        quantity: returned.material?.quantity ?? returned.quantity,
        condition: returned.condition ?? returned.destination,
        amount: returned.amount,
      });
    }
  if (testsAccess)
    for (const test of tests) {
      const product = await demoDb.products.get(test.productId);
      rows.push({
        id: "test:" + test.id,
        type: "test",
        title: "Out for Test",
        category: "Test Items",
        createdAt: test.takenDate,
        employeeId: test.employeeId,
        employeeName: name(test.employeeId),
        reference: test.code,
        entityType: "test",
        entityId: test.id,
        description: product?.name ?? "Test item",
        quantity: test.quantity,
      });
      for (const entry of history.filter(
        (h) => h.reference === test.code && h.action === "test.returned",
      ))
        rows.push({
          id: "test-event:" + entry.id,
          type: "test-returned",
          title: "Test Item Returned",
          category: "Test Items",
          createdAt: entry.createdAt,
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          reference: test.code,
          entityType: "test",
          entityId: test.id,
          description: entry.description,
          quantity: test.quantity,
        });
      const converted = sales.find((s) => s.sourceTestId === test.id);
      if (converted)
        rows.push({
          id: "test-converted:" + test.id,
          type: "test-converted",
          title: "Test Converted to Sale",
          category: "Test Items",
          createdAt: converted.createdAt,
          employeeId: converted.employeeId,
          employeeName: converted.employeeName,
          reference: converted.invoice,
          entityType: "sale",
          entityId: converted.id,
          saleId: converted.id,
          description: product?.name ?? "Test item",
          quantity: test.quantity,
        });
    }
  for (const note of notes) rows.push(noteEvent(note));
  for(const entry of await demoDb.reminderHistory.where('customerId').equals(customerId).toArray()) {
    if(entry.kind==='credit'?!credit:!testsAccess)continue;
    rows.push({id:entry.id,type:entry.action==='prepared'?'reminder-prepared':entry.action,title:entry.action==='prepared'?'Reminder Prepared':entry.action==='whatsapp-opened'?'WhatsApp Opened':'Manually Marked Contacted',category:entry.kind==='credit'?'Credit':'Test Items',createdAt:entry.createdAt,employeeId:entry.employeeId,employeeName:entry.employeeName??name(entry.employeeId),reference:entry.obligationId,entityType:'reminder',entityId:entry.id,description:entry.message??'Manual contact recorded'});
  }
  const selected = rows.filter(
    (e) =>
      (!filter.category ||
        filter.category === "All" ||
        e.category === filter.category) &&
      (!filter.from || shopDay(e.createdAt) >= filter.from) &&
      (!filter.to || shopDay(e.createdAt) <= filter.to),
  );
  selected.sort(
    (a, b) =>
      (a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) *
      (filter.order === "oldest" ? 1 : -1),
  );
  const offset = Math.max(0, filter.offset ?? 0),
    limit = Math.min(100, Math.max(1, filter.limit ?? 30));
  return {
    rows: selected.slice(offset, offset + limit),
    total: selected.length,
    ...(credit ? { outstanding: running } : {}),
  };
}
function noteEvent(
  note: import("../../types/customer-activity").CustomerNote,
): CustomerActivity {
  return {
    id: note.id,
    type: "note",
    title: "Internal Account Note",
    category: "Notes",
    createdAt: note.createdAt,
    employeeId: note.employeeId,
    employeeName: note.employeeName,
    reference: "Internal note",
    entityType: "customer-note",
    entityId: note.id,
    description: note.text,
  };
}
export async function addCustomerNote(
  customerId: string,
  input: { idempotencyKey: string; text: string },
) {
  authorize("customers.edit");
  requireValue(
    input.text.trim() && input.text.length <= 2000 && input.idempotencyKey,
    "Enter an internal note of up to 2,000 characters.",
  );
  return atomic(async () => {
    requireValue(await demoDb.customers.get(customerId), "Customer not found.");
    const previous = await demoDb.customerNotes
      .where("idempotencyKey")
      .equals(input.idempotencyKey)
      .first();
    if (previous) {
      requireValue(
        previous.customerId === customerId &&
          previous.text === input.text.trim(),
        "This note request was already used for different values.",
      );
      return noteEvent(previous);
    }
    const employee = actor(),
      note = {
        id: newId(),
        customerId,
        text: input.text.trim(),
        employeeId: employee.id,
        employeeName: employee.name,
        createdAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };
    await demoDb.customerNotes.add(note);
    await audit(
      "customer.note_added",
      "Customers",
      "Internal account note added",
      customerId,
    );
    return noteEvent(note);
  });
}
