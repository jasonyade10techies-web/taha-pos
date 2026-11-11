import {
  demoDb,
  atomic,
  newId,
  nextCode,
  requireValue,
  money,
} from "./database";
import {
  authorize,
  actor,
  audit,
  move,
  editable,
  amount,
  allowed,
  validDate,
} from "./common";
import { LocalProductRepository } from "./catalog-repositories";
import {customerTimeline,addCustomerNote} from './customer-activity';
import {reminderObligations,recordReminder,reminderAlerts} from './reminders';
import {normalizeWhatsapp} from '../reminders';
import type {
  CustomerRepository,
  CreditRepository,
  ShiftRepository,
  DevicePurchaseRepository,
  ReportRepository,
  WebsiteRepository,
} from "../repositories/interfaces";
import type {
  DevicePurchase,
  TestOut,
  Shift,
  RepairJob,
} from "../../types/demo";

export const localCustomers: CustomerRepository = {
  reminders:reminderObligations,recordReminder,reminderAlerts,
  timeline:customerTimeline,
  async activityDetail(customerId,eventId){
    let event:import('../../types/customer-activity').CustomerActivity|undefined,offset=0,total=0;
    do{const page=await customerTimeline(customerId,{offset,limit:100});total=page.total;event=page.rows.find(row=>row.id===eventId);offset+=page.rows.length;}while(!event&&offset<total);
    requireValue(event,'History entry unavailable for this customer or permission.');
    const selected=event!;
    const sale=selected.saleId&&allowed('sales.view')?await demoDb.sales.get(selected.saleId):undefined;
    if(sale){
      const entries=await demoDb.ledger.where('customerId').equals(customerId).toArray();
      sale.outstanding=money(entries.filter(row=>row.saleId===sale.id||!row.saleId&&row.reference===sale.invoice).reduce((sum,row)=>sum+row.debit-row.credit,0));
    }
    const returned=selected.entityType==='return'?await demoDb.returns.get(selected.entityId):undefined;
    const payment=selected.entityType==='payment'?await demoDb.payments.get(selected.entityId):undefined;
    const test=selected.entityType==='test'?await demoDb.testOuts.get(selected.entityId):undefined;
    return {sale,returned,payment,test,event:selected};
  },
  addNote:addCustomerNote,
  ...editable(demoDb.customers, "Credit", "credit.create", (c) => {
    requireValue(c.name.trim(), "Customer name is required.");
    if (c.creditLimit !== null) amount(c.creditLimit, "Credit limit");
  }),
  async save(value) {
    return atomic(async () => {
      const previous = await demoDb.customers.get(value.id);
      requireValue(allowed(previous ? "customers.edit" : "customers.create") || allowed("credit.create"), "You do not have permission to save this customer.");
      requireValue(value.name.trim(), "Customer name is required.");
      const canCredit = allowed("credit.create") || allowed("customers.credit");
      const next = { ...value, creditLimit: canCredit ? value.creditLimit : previous?.creditLimit ?? null, creditEnabled: canCredit ? value.creditEnabled : previous?.creditEnabled ?? false };
      next.dueAt=canCredit?value.dueAt:previous?.dueAt;next.reminderEnabled=canCredit?value.reminderEnabled:previous?.reminderEnabled;
      requireValue(!next.dueAt||Number.isFinite(Date.parse(next.dueAt)),'Enter a valid payment due date and time.');
      requireValue(next.whatsappSameAsPhone!==false||!next.whatsappNumber||normalizeWhatsapp(next.whatsappNumber),'Enter a valid WhatsApp number.');
      if (next.creditLimit !== null) amount(next.creditLimit, "Credit limit");
      requireValue(!next.creditEnabled || next.phone.trim(), "Enter a phone number before enabling credit.");
      await demoDb.customers.put(next);
      await audit(previous ? "customer.updated" : "customer.created", "Customers", next.name, next.id);
      return next;
    });
  },
  async outstanding(id) {
    return money(
      (await demoDb.ledger.where("customerId").equals(id).toArray()).reduce(
        (s, l) => s + l.debit - l.credit,
        0,
      ),
    );
  },
};
export class LocalCreditRepository implements CreditRepository {
  ledger = () => demoDb.ledger.orderBy("createdAt").toArray();
  tests = () => demoDb.testOuts.toArray();
  async receive(
    customerId: string,
    value: number,
    methodId: string,
    reference: string,
    notes: string,
  ) {
    authorize("credit.receive_payment");
    return atomic(async () => {
      const customer = await demoDb.customers.get(customerId);
      requireValue(customer, "Choose a customer.");
      requireValue(
        value > 0 &&
          Number.isFinite(value) &&
          value <= (await localCustomers.outstanding(customerId)),
        "Payment must be positive and cannot exceed outstanding credit.",
      );
      const method = await demoDb.paymentMethods.get(methodId);
      requireValue(
        method?.enabled && method.kind !== "Credit",
        "Select an enabled collection method.",
      );
      const code = await nextCode("TM-PAY-");
      const now = new Date().toISOString();
      const paymentId=newId();
      await demoDb.payments.add({
        id: paymentId,
        code,
        saleId: "",
        customerId,
        methodId,
        amount: money(value),
        kind: "collection",
        reference,
        notes,
        employeeId: actor().id,
        createdAt: now,
      });
      const previous=await demoDb.ledger.where('customerId').equals(customerId).toArray(),sales=(await demoDb.sales.where('customerId').equals(customerId).toArray()).filter(s=>s.status!=='Voided').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
      let remaining=money(value);
      for(const sale of sales){const debt=money(previous.filter(l=>l.saleId===sale.id||!l.saleId&&l.reference===sale.invoice).reduce((sum,l)=>sum+l.debit-l.credit,0));const applied=Math.min(remaining,Math.max(0,debt));if(!applied)continue;await demoDb.ledger.add({id:newId(),saleId:sale.id,paymentId,customerId,reference:code,description:notes||'Credit payment received',debit:0,credit:applied,employeeId:actor().id,createdAt:now});remaining=money(remaining-applied);if(!remaining)break;}
      if(remaining)await demoDb.ledger.add({
        id: newId(),
        paymentId,
        customerId,
        reference: code,
        description: notes || "Credit payment received",
        debit: 0,
        credit: remaining,
        employeeId: actor().id,
        createdAt: now,
      });
      await audit(
        "credit.collected",
        "Credit",
        `${actor().name} collected PKR ${value.toLocaleString()} from ${customer.name}`,
        code,
      );
      return code;
    });
  }
  async send(test: TestOut) {
    authorize("inventory.transfer");
    return atomic(async () => {
      requireValue(
        await demoDb.customers.get(test.customerId),
        "Select a customer or shop.",
      );
      const product = await demoDb.products.get(test.productId);
      requireValue(
        product?.state === "active",
        "Select an active stock product.",
      );
      requireValue(
        validDate(test.takenDate) &&
          validDate(test.dueDate) &&
          Date.parse(test.dueDate) >= Date.parse(test.takenDate),
        "Due date must follow the taken date.",
      );
      requireValue(
        test.quantity > 0 && Number.isInteger(test.quantity),
        "Quantity must be a positive whole number.",
      );
      const value = {
        ...test,
        code: await nextCode("TM-TEST-"),
        employeeId: actor().id,
        status: "OUT" as const,
      };
      await move(
        test.productId,
        test.locationId,
        -test.quantity,
        "OUT_FOR_TEST",
        value.code,
        test.notes,
      );
      await demoDb.testOuts.add(value);
      await audit(
        "test.sent",
        "Credit",
        `${test.quantity} ${product.name} sent for testing; no revenue recorded`,
        value.code,
      );
      return value;
    });
  }
  async returnTest(id: string) {
    authorize("inventory.transfer");
    await atomic(async () => {
      const test = await demoDb.testOuts.get(id);
      requireValue(
        test?.status === "OUT",
        "Only outstanding test items can be returned.",
      );
      await move(
        test.productId,
        test.locationId,
        test.quantity,
        "TEST_RETURN",
        test.code,
      );
      await demoDb.testOuts.update(id, { status: "RETURNED" });
      await audit(
        "test.returned",
        "Credit",
        "Test items returned to available stock",
        test.code,
      );
    });
  }
  async extendTest(id: string, date: string) {
    authorize("inventory.transfer");
    requireValue(
      validDate(date) && date >= new Date().toISOString().slice(0, 10),
      "Choose today or a future deadline.",
    );
    await atomic(async () => {
      requireValue(
        (await demoDb.testOuts.get(id))?.status === "OUT",
        "This test-out is already closed.",
      );
      const previous=await demoDb.testOuts.get(id);
      requireValue(!previous?.dueDate||previous.dueDate.length<=10||Date.parse(date)>=Date.parse(previous.dueDate),'An extension cannot shorten the existing return deadline.');
      await demoDb.testOuts.update(id, { dueDate: date });
      await audit(
        "test.extended",
        "Credit",
        `Test deadline extended to ${date}`,
        id,
      );
    });
  }
}
export class LocalDevicePurchaseRepository implements DevicePurchaseRepository {
  list = () => demoDb.devices.toArray();
  get = (id: string) => demoDb.devices.get(id);
  async purchase(value: DevicePurchase, locationId: string) {
    authorize("devices.buy_used");
    requireValue(
      value.seller.trim() && value.phone.trim() && value.model.trim(),
      "Seller, phone and device model are required.",
    );
    amount(value.purchasePrice);
    amount(value.targetPrice);
    requireValue(
      value.minimumPrice >= 0 && value.minimumPrice <= value.targetPrice,
      "Minimum price cannot exceed target price.",
    );
    requireValue(
      value.battery >= 0 && value.battery <= 100,
      "Battery health must be between 0 and 100.",
    );
    return atomic(async () => {
      if (value.imei1) {
        requireValue(
          /^\d{15}$/.test(value.imei1),
          "IMEI 1 must contain 15 digits.",
        );
        requireValue(
          !(await demoDb.devices.where("imei1").equals(value.imei1).first()),
          "This IMEI is already registered.",
        );
      }
      if (value.imei2)
        requireValue(
          /^\d{15}$/.test(value.imei2),
          "IMEI 2 must contain 15 digits.",
        );
      const productId = newId();
      const code = await nextCode("TM-P-");
      await demoDb.products.add({
        id: productId,
        internalCode: code,
        name: `${value.brand} ${value.model} · Used`,
        category: "Phones",
        brand: value.brand,
        compatibleModel: `${value.model} · ${value.storage}`,
        qualityGrade: "Used",
        color: value.color,
        sellingPrice: value.targetPrice,
        minimumSellingPrice: value.minimumPrice,
        aliases: [value.imei1, value.imei2, value.serial],
        lowStockLevel: 0,
        state: "active",
        locationId,
        variant: value.storage,
        unit: "Piece",
        notes: value.condition,
        image: value.photos[0] ?? "",
        createdAt: new Date().toISOString(),
      });
      await demoDb.financials.add({ id: productId, cost: value.purchasePrice });
      const record = {
        ...value,
        employeeId: actor().id,
        code: await nextCode("TM-BUY-"),
        productId,
        createdAt: new Date().toISOString(),
      };
      await demoDb.devices.add(record);
      await move(productId, locationId, 1, "USED_DEVICE_PURCHASE", record.code);
      await audit(
        "device.purchased",
        "Purchasing",
        `${record.brand} ${record.model} purchased from ${record.seller}`,
        record.code,
      );
      return record;
    });
  }
  async updateStatus(id: string, status: DevicePurchase["status"]) {
    authorize("devices.buy_used");
    await atomic(async () => {
      const device = await this.get(id);
      requireValue(
        device && device.status !== "Sold",
        "Sold devices cannot change inventory status.",
      );
      requireValue(
        status !== "Sold",
        "Complete a sale to mark this device sold.",
      );
      await demoDb.devices.update(id, { status });
      await demoDb.products.update(device.productId, {
        state: status === "In Stock" ? "active" : "archived",
      });
      await audit(
        "device.status",
        "Purchasing",
        `Purchased device marked ${status}`,
        device.code,
      );
    });
  }
}
export class LocalShiftRepository implements ShiftRepository {
  private base = editable(demoDb.shifts, "Shifts", "shifts.manage");
  list = this.base.list;
  get = this.base.get;
  async save(shift: Shift) {
    requireValue(shift.start < shift.end, "Shift end must follow start.");
    requireValue(shift.date, "Select a date.");
    requireValue(
      !!(await demoDb.employees.get(shift.employeeId)),
      "Select an employee.",
    );
    if (!(await this.get(shift.id)))
      requireValue(
        !(await this.list()).some(
          (s) =>
            s.employeeId === shift.employeeId &&
            s.date === shift.date &&
            s.status !== "Closed",
        ),
        "This employee already has a shift on that date.",
      );
    return this.base.save(shift);
  }
  async closing(id: string) {
    const shift = await this.get(id);
    requireValue(shift, "Shift not found.");
    const methods = await demoDb.paymentMethods.toArray();
    const cashIds = methods.filter((m) => m.kind === "Cash").map((m) => m.id);
    const start = new Date(`${shift.date}T${shift.start}`).getTime();
    const end = new Date(`${shift.date}T${shift.end}`).getTime();
    const payments = (
      await demoDb.payments
        .where("employeeId")
        .equals(shift.employeeId)
        .toArray()
    ).filter(
      (p) =>
        cashIds.includes(p.methodId) &&
        Date.parse(p.createdAt) >= start &&
        Date.parse(p.createdAt) <= end,
    );
    const cashSales =
      payments
        .filter((p) => p.kind === "sale")
        .reduce((s, p) => s + p.amount, 0) -
      payments
        .filter((p) => p.kind === "refund" || p.kind === "reversal")
        .reduce((s, p) => s + p.amount, 0);
    const collections = payments
      .filter((p) => p.kind === "collection")
      .reduce((s, p) => s + p.amount, 0);
    const purchases = (await demoDb.devices.toArray())
      .filter(
        (d) =>
          d.employeeId === shift.employeeId &&
          Date.parse(d.createdAt) >= start &&
          Date.parse(d.createdAt) <= end,
      )
      .reduce((s, d) => s + d.purchasePrice, 0);
    return {
      cashSales: money(cashSales),
      collections: money(collections),
      purchases: money(purchases),
      expected: money(
        shift.openingCash +
          cashSales +
          collections -
          shift.cashExpenses -
          purchases,
      ),
    };
  }
  async close(id: string, counted: number, expenses: number, notes: string) {
    authorize("shifts.manage");
    await atomic(async () => {
      const shift = await this.get(id);
      requireValue(
        shift?.status === "Open",
        "Only an open shift can be closed.",
      );
      amount(counted, "Counted cash");
      amount(expenses, "Expenses");
      const cash = await this.closing(id);
      const expected = money(cash.expected + shift.cashExpenses - expenses);
      const difference = money(counted - expected);
      requireValue(
        !difference || notes.trim(),
        "Explain the cash difference before closing.",
      );
      await demoDb.shifts.update(id, {
        status: "Closed",
        countedCash: counted,
        cashExpenses: expenses,
        expectedCash: expected,
        difference,
        notes,
        closedAt: new Date().toISOString(),
      });
      await audit(
        "shift.closed",
        "Shifts",
        `Shift closed with PKR ${difference.toLocaleString()} cash difference`,
        id,
      );
    });
  }
}
export class LocalReportRepository implements ReportRepository {
  async snapshot(from = "", to = "") {
    authorize("reports.view");
    const inRange = (time: string) =>
      (!from || new Date(time).toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}) >= from) && (!to || new Date(time).toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}) <= to);
    const sales = (await demoDb.sales.toArray()).filter((s) =>
      inRange(s.createdAt),
    );
    const payments = (await demoDb.payments.toArray()).filter((p) =>
      inRange(p.createdAt),
    );
    const returns = (await demoDb.returns.toArray()).filter((r) =>
      inRange(r.createdAt),
    );
    const ledger = (await demoDb.ledger.toArray()).filter((l) =>
      inRange(l.createdAt),
    );
    const costBySale: Record<string, number> = {};
    const unknownCostSales: string[] = [];
    const restoredCostByReturn: Record<string,number> = {};
    let profit: number | null = null;
    if (allowed("profit.view")) {
      for (const sale of sales) {
        const financial=await demoDb.saleCosts.get(sale.id);
        costBySale[sale.id] = financial?.cost ?? 0;
        if (financial?.unknownMaterialCost&&sale.status!=='Voided') unknownCostSales.push(sale.id);
      }
      profit = sales
        .filter((s) => s.status !== "Voided")
        .reduce((sum, s) => sum + s.total - (s.tax?.amount??0) - costBySale[s.id], 0);
      for (const returned of returns) {
        const original = await demoDb.sales.get(returned.saleId);
        if (!original || original.status === "Voided") continue;
        const financial = await demoDb.saleCosts.get(original.id);
        const line = original.lines.find(
          (l) => l.productId === returned.productId,
        );
        const restoredCost =
          line && (!line.service || line.material) && returned.destination === "Sellable Stock"
            ? ((financial?.byProduct?.[line.productId] ?? 0) / line.quantity) *
              returned.quantity
            : 0;
        restoredCostByReturn[returned.id]=restoredCost;
        profit -= returned.amount - (returned.taxAmount ?? (line ? (line.taxAmount??0)*returned.quantity/line.quantity : 0)) - restoredCost;
      }
      profit = money(profit);
      if (unknownCostSales.length) profit=null;
    }
    return {
      sales,
      payments,
      returns,
      ledger,
      products: await new LocalProductRepository().pos(),
      customers: await demoDb.customers.toArray(),
      employees: await demoDb.employees.toArray(),
      shifts: await demoDb.shifts.toArray(),
      profit,
      costBySale,restoredCostByReturn,unknownCostSales,
    };
  }
}
export const localJobs = editable(
  demoDb.jobs,
  "Repairs",
  "sales.create",
  (j) => {
    requireValue(
      j.customerName.trim() && j.device.trim() && j.problem.trim(),
      "Customer, device and problem are required.",
    );
    amount(j.estimate);
    requireValue(
      j.advance >= 0 && j.advance <= j.estimate,
      "Advance cannot exceed estimate.",
    );
  },
  "TM-REP-",
);
export const localWebsite: WebsiteRepository = {
  products: () => demoDb.website.toArray(),
  async saveProduct(value) {
    authorize("products.edit");
    await atomic(async () => {
      amount(value.price, "Website price");
      await demoDb.website.put(value);
      await audit(
        "website.product",
        "Website",
        "Website visibility or pricing changed",
        value.id,
      );
    });
  },
  enquiries: editable(demoDb.enquiries, "Website", "website.enquiries"),
  async convert(id, technicianId) {
    authorize("website.enquiries");
    return atomic(async () => {
      const enquiry = await demoDb.enquiries.get(id);
      requireValue(
        enquiry &&
          !enquiry.jobId &&
          enquiry.status !== "Converted" &&
          enquiry.status !== "Closed",
        "This enquiry is already closed or converted.",
      );
      const job: RepairJob = {
        id: newId(),
        code: await nextCode("TM-REP-"),
        customerId: "",
        customerName: enquiry.name,
        phone: enquiry.phone,
        device: enquiry.device,
        imei: "",
        problem: enquiry.problem,
        damage: "",
        photos: [],
        estimate: enquiry.quote,
        advance: 0,
        technicianId,
        notes: enquiry.notes,
        status: "Received",
        createdAt: new Date().toISOString(),
      };
      await demoDb.jobs.add(job);
      await demoDb.enquiries.update(id, { status: "Converted", jobId: job.id });
      await audit(
        "enquiry.converted",
        "Website",
        "Repair enquiry converted to job",
        job.code,
      );
      return job;
    });
  },
};
