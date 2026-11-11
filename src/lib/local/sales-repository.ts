import {quoteTax} from '../tax';
import {
  demoDb,
  atomic,
  newId,
  nextCode,
  requireValue,
  money,
} from "./database";
import { actor, authorize, audit, move, allowed, amount } from "./common";
import type {
  SalesRepository,
  CouponRepository,
} from "../repositories/interfaces";
import type {
  SaleInput,
  Sale,
  SaleLine,
  ReturnRecord,
  Coupon,
} from "../../types/demo";
import { editable } from "./common";
import { LocalProductRepository } from "./catalog-repositories";
import { consumeServiceMaterial } from './service-materials';
import {recordDamagedReturn,conditionLocations} from './inventory-conditions';
import type {ReturnOptions} from '../../types/transactions';
import {receiptSearch} from './receipt-search';

export const localCoupons: CouponRepository = {
  ...editable(
    demoDb.coupons,
    "Coupons",
    "pricing.discount_within_range",
    (c) => {
      requireValue(c.code.trim(), "Coupon code is required.");
      requireValue(
        c.value > 0 &&
          Number.isFinite(c.value) &&
          (c.type !== "Percentage" || c.value <= 100),
        "Enter a valid coupon value.",
      );
      requireValue(c.start <= c.end, "End date must follow start date.");
      requireValue(
        c.maxUses >= 0 && c.perCustomerLimit >= 0 && c.minimum >= 0,
        "Coupon limits cannot be negative.",
      );
    },
  ),
  async validate(code, lines, customerId = "") {
    const coupon = await demoDb.coupons
      .where("code")
      .equals(code.trim().toUpperCase())
      .first();
    const now = new Date().toISOString().slice(0, 10);
    requireValue(coupon?.active, "Coupon is invalid or inactive.");
    requireValue(
      coupon.start <= now && coupon.end >= now,
      "Coupon is not valid on this date.",
    );
    requireValue(
      !coupon.maxUses || coupon.uses < coupon.maxUses,
      "Coupon usage limit reached.",
    );
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    requireValue(
      subtotal >= coupon.minimum,
      `Minimum purchase is PKR ${coupon.minimum.toLocaleString()}.`,
    );
    if (coupon.perCustomerLimit) {
      requireValue(customerId, "Select a customer for this coupon.");
      const used = (
        await demoDb.sales.where("customerId").equals(customerId).toArray()
      ).filter((s) => s.coupon === coupon.code && s.status !== "Voided").length;
      requireValue(
        used < coupon.perCustomerLimit,
        "Customer coupon limit reached.",
      );
    }
    const eligible = lines.filter(
      (l) =>
        coupon.eligible === "All" ||
        (coupon.eligible === "Services" && l.product.category === "Services") ||
        (coupon.eligible === "Products" &&
          coupon.targets.includes(l.product.id)) ||
        (coupon.eligible === "Categories" &&
          coupon.targets.includes(l.product.category)),
    );
    const base = eligible.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const room = eligible.reduce(
      (s, l) =>
        s +
        l.quantity * Math.max(0, l.unitPrice - l.product.minimumSellingPrice),
      0,
    );
    const discount = money(
      Math.min(
        coupon.type === "Fixed" ? coupon.value : (base * coupon.value) / 100,
        room,
      ),
    );
    requireValue(
      discount > 0,
      "No eligible items or discount room above minimum prices.",
    );
    return { code: coupon.code, discount };
  },
};

export class LocalSalesRepository implements SalesRepository {
  page=receiptSearch;
  lookup=receiptSearch;
  list = () => demoDb.sales.orderBy("createdAt").reverse().toArray();
  get = (id: string) => demoDb.sales.get(id);
  returns = (saleId?:string) => saleId?demoDb.returns.where('saleId').equals(saleId).reverse().sortBy('createdAt'):demoDb.returns.orderBy("createdAt").reverse().toArray();
  async complete(input: SaleInput) {
    authorize("sales.create");
    requireValue(input.lines.length, "Your cart is empty.");
    requireValue(
      input.idempotencyKey,
      "Checkout request is missing its identifier.",
    );
    return atomic(async () => {
      const previous = await demoDb.meta.get(
        `checkout:${input.idempotencyKey}`,
      );
      if (previous) {
        const existing = await demoDb.sales.get(input.idempotencyKey);
        requireValue(existing, "Checkout state is invalid.");
        return existing;
      }
      const settings = await demoDb.settings.get("main");
      requireValue(settings, "Settings unavailable.");
      const pos = await new LocalProductRepository().pos();
      const customer = input.customerId
        ? await demoDb.customers.get(input.customerId)
        : undefined;
      requireValue(!input.customerId || customer, "Customer no longer exists.");
      const test = input.sourceTestId
        ? await demoDb.testOuts.get(input.sourceTestId)
        : undefined;
      if (input.sourceTestId) {
        requireValue(
          test?.status === "OUT",
          "This test-out is no longer available for conversion.",
        );
        requireValue(
          input.customerId === test.customerId,
          "Use the same customer as the test-out.",
        );
        requireValue(
          input.lines
            .filter((l) => l.productId === test.productId)
            .reduce((s, l) => s + l.quantity, 0) === test.quantity,
          "Convert the full test-out quantity.",
        );
      }
      requireValue(
        new Set(input.lines.map((l) => l.productId)).size ===
          input.lines.length,
        "Duplicate cart lines are not allowed.",
      );
      const lines: SaleLine[] = [];
      for (const item of input.lines) {
        if(!item.customService)requireValue(!(await demoDb.services.get(item.productId))?.linkedProductId,'Review this linked template in Custom Service and select its material locations before checkout.');
        if (item.customService) authorize("services.create_custom");
        const p = item.customService ? {
          id: item.productId, name: item.customService.name.trim(), category: "Services", qualityGrade: "Custom Service",
          color: "", sellingPrice: item.customService.sellingPrice, minimumSellingPrice: item.customService.minimumSellingPrice,
        } : pos.find((p) => p.id === item.productId);
        if (item.customService) {
          requireValue(item.productId.startsWith("custom:") && p?.name, "Custom service name is required.");
          amount(p!.sellingPrice); amount(p!.minimumSellingPrice);
          requireValue(p!.minimumSellingPrice <= p!.sellingPrice, "Minimum price cannot exceed service price.");
        }
        requireValue(p, "A cart item is no longer active.");
        if (item.customService) pos.push({...p,internalCode:"Custom Service",brand:"",compatibleModel:"",quantity:0,location:null,aliases:[],lowStockLevel:0});
        const trackedDevice = await demoDb.devices
          .where("productId")
          .equals(p.id)
          .first();
        requireValue(
          !trackedDevice ||
            (item.quantity === 1 && trackedDevice.status === "In Stock"),
          "An individually tracked device can only be sold once.",
        );
        requireValue(
          Number.isInteger(item.quantity) && item.quantity > 0,
          "Quantities must be positive whole numbers.",
        );
        amount(item.unitPrice);
        requireValue(
          item.unitPrice <= p.sellingPrice,
          "Price exceeds the current listed price.",
        );
        if (item.unitPrice < p.sellingPrice) {
          authorize("pricing.discount_within_range");
          requireValue(
            settings.bargaining,
            "Bargaining is disabled in settings.",
          );
          requireValue(item.reason?.trim(), "Add a negotiation reason.");
        }
        if (item.unitPrice < p.minimumSellingPrice) {
          requireValue(
            settings.belowMinimum !== "Block",
            "Below-minimum pricing is blocked.",
          );
          if (settings.belowMinimum === "Manager Approval") {
            const manager = item.approval
              ? await demoDb.employees.get(item.approval.managerId)
              : undefined;
            requireValue(
              manager?.status === "active" &&
                (manager.role === "owner" ||
                  manager.permissions.includes("pricing.override_minimum")) &&
                item.approval?.price === item.unitPrice &&
                item.approval.employeeId === actor().id,
              "A demo manager approval is required.",
            );
          } else
            requireValue(
              item.reason?.trim(),
              "A reason is required below minimum.",
            );
        }
        const balances = await demoDb.balances
          .where("productId")
          .equals(p.id)
          .toArray();
        const location =
          balances
            .filter((b) => b.quantity > 0)
            .sort((a, b) => b.quantity - a.quantity)[0]?.locationId ??
          (await demoDb.products.get(p.id))?.locationId ??
          "";
        lines.push({
          productId: p.id,
          name: p.name,
          variant: [p.qualityGrade, p.color].filter(Boolean).join(" · "),
          quantity: item.quantity,
          originalPrice: p.sellingPrice,
          unitPrice: item.unitPrice,
          minimumPrice: p.minimumSellingPrice,
          discount: 0,
          total: money(item.quantity * item.unitPrice),
          locationId: test?.productId === p.id ? test.locationId : location,
          service: p.category === "Services",
          reason: item.reason,
          approval: item.approval,
        });
      }
      const coupon = input.coupon
        ? await localCoupons.validate(
            input.coupon,
            lines.map((l) => ({
              product: pos.find((p) => p.id === l.productId)!,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            })),
            input.customerId,
          )
        : null;
      let remaining = coupon?.discount ?? 0;
      const cp: Coupon | undefined = coupon
        ? await demoDb.coupons.where("code").equals(coupon.code).first()
        : undefined;
      for (const line of lines) {
        const p = pos.find((p) => p.id === line.productId)!;
        const eligible =
          !cp ||
          cp.eligible === "All" ||
          (cp.eligible === "Services" && line.service) ||
          (cp.eligible === "Products" && cp.targets.includes(line.productId)) ||
          (cp.eligible === "Categories" && cp.targets.includes(p.category));
        if (!eligible) continue;
        line.discount = money(
          Math.min(
            remaining,
            Math.max(0, (line.unitPrice - (line.minimumPrice??line.unitPrice)) * line.quantity),
          ),
        );
        line.total = money(line.total - line.discount);
        remaining = money(remaining - line.discount);
      }
      const subtotal = money(
        lines.reduce((s, l) => s + l.originalPrice * l.quantity, 0),
      );
      const tax = quoteTax(lines.map(line=>({product:{category:line.service?"Services":"Products"},quantity:line.quantity,unitPrice:line.total/line.quantity})),0,settings.taxProfiles,settings.defaultTaxProfileId);
      const eligibleTax=lines.filter(line=>tax.appliesTo==='Both'||line.service===(tax.appliesTo==='Services'));
      const taxBase=eligibleTax.reduce((sum,line)=>sum+line.total,0);let taxRemaining=tax.amount;
      eligibleTax.forEach((line,index)=>{const part=index===eligibleTax.length-1?taxRemaining:Math.min(taxRemaining,money(taxBase?tax.amount*line.total/taxBase:0));line.taxAmount=part;if(tax.mode==='Exclusive')line.total=money(line.total+part);taxRemaining=money(taxRemaining-part);});
      const total = tax.total;
      const methods = await demoDb.paymentMethods.toArray();
      requireValue(input.payments.length, "Select a payment method.");
      let credit = 0;
      let cash = 0;
      for (const payment of input.payments) {
        requireValue(
          payment.amount > 0 && Number.isFinite(payment.amount),
          "Payment amounts must be positive.",
        );
        const method = methods.find(
          (m) => m.id === payment.methodId && m.enabled,
        );
        requireValue(method, "A payment method is disabled.");
        if (method.kind === "Credit") {
          authorize("credit.create");
          requireValue(
            settings.creditEnabled && customer,
            "Select an internal customer for credit.",
          );
          credit += payment.amount;
        }
        if (method.kind === "Cash") cash += payment.amount;
        if (method.kind === "Digital") {
          authorize("payments.approve_electronic");
          requireValue(
            payment.verified,
            "Confirm that the digital payment was received.",
          );
          requireValue(
            !settings.requireProof || payment.proof,
            "Upload payment proof.",
          );
        }
      }
      requireValue(
        Math.abs(input.payments.reduce((s, p) => s + p.amount, 0) - total) <
          0.005,
        "Payment allocations must equal the total.",
      );
      requireValue(
        input.cashReceived >= cash,
        "Cash received is less than the cash amount due.",
      );
      if (credit) requireValue(customer?.creditEnabled !== false, "Credit is disabled for this customer.");
      const creditDueAt=input.creditDueAt||customer?.dueAt;
      if(credit){requireValue(!settings.creditDueRequired||creditDueAt,'Choose a payment due date and time before completing this credit sale.');requireValue(!creditDueAt||Number.isFinite(Date.parse(creditDueAt)),'Enter a valid payment due date.');}
      if (credit && customer?.creditLimit !== null) {
        const ledger = await demoDb.ledger
          .where("customerId")
          .equals(customer!.id)
          .toArray();
        const outstanding = ledger.reduce((s, l) => s + l.debit - l.credit, 0);
        requireValue(
          outstanding + credit <= customer!.creditLimit! ||
            allowed("credit.override_limit"),
          "Customer credit limit would be exceeded.",
        );
      }
      const id = input.idempotencyKey;
      const invoice = await nextCode("TM-INV-");
      const employee = actor();
      const sale: Sale = {
        id,
        invoice,
        tax,
        receipt: {storeName:settings.storeName,branch:settings.branch,phone:settings.phone??"",address:settings.address??"",footer:settings.receiptFooter,showCashier:settings.shopConfiguration?.showCashierOnReceipt!==false,showZeroTax:settings.showZeroTax},
        customerId: input.customerId,
        customerName: customer?.name ?? "Walk-in Customer",
        employeeId: employee.id,
        employeeName: employee.name,
        createdAt: new Date().toISOString(),
        lines,
        subtotal,
        discount: money(
          lines.reduce(
            (s, l) =>
              s + (l.originalPrice - l.unitPrice) * l.quantity,
            0,
          ),
        ),
        total,
        coupon: coupon?.code ?? "",
        couponDiscount: coupon?.discount ?? 0,
        paid: money(total-credit), outstanding: money(credit), cashReceived: input.cashReceived, change: money(Math.max(0,input.cashReceived-cash)),creditDueAt:credit?creditDueAt:undefined,
        status: credit >= total ? "Credit" : credit > 0 ? "Partial" : "Paid",
        payments: input.payments,
        returned: {},
        sourceTestId: input.sourceTestId,
      };
      let cost = 0;
      let unknownMaterialCost = false;
      const byProduct: Record<string, number> = {};
      for (const line of lines) {
        if (line.service) {
          const material=input.lines.find(l=>l.productId===line.productId)?.customService?.material;
          if (material) {
            const materialCost=await consumeServiceMaterial(material,line,invoice,tax.mode);
            if (materialCost===null) unknownMaterialCost=true;
            else {byProduct[line.productId]=materialCost;cost+=materialCost;}
          }
          continue;
        }
        if (test?.productId === line.productId)
          await move(
            line.productId,
            test.locationId,
            test.quantity,
            "TEST_RETURN",
            invoice,
            "Test converted to sale",
          );
        let qty = line.quantity;
        line.stockAllocations = [];
        const balances = await demoDb.balances
          .where("productId")
          .equals(line.productId)
          .toArray();
        balances.sort((a, b) =>
          a.locationId === line.locationId
            ? -1
            : b.locationId === line.locationId
              ? 1
              : 0,
        );
        for (const b of balances) {
          const take = Math.min(Math.max(0, b.quantity), qty);
          if (take) {
            await move(line.productId, b.locationId, -take, "SALE", invoice);
            line.stockAllocations.push({
              locationId: b.locationId,
              quantity: take,
            });
            qty -= take;
          }
        }
        if (qty > 0 && settings.negativeStock) {
          await move(line.productId, line.locationId, -qty, "SALE", invoice);
          line.stockAllocations.push({
            locationId: line.locationId,
            quantity: qty,
          });
          qty = 0;
        }
        requireValue(
          qty === 0,
          "Stock changed. Update the cart and try again.",
        );
        byProduct[line.productId] =
          ((await demoDb.financials.get(line.productId))?.cost ?? 0) *
          line.quantity;
        cost += byProduct[line.productId];
        const device = await demoDb.devices
          .where("productId")
          .equals(line.productId)
          .first();
        if (device) await demoDb.devices.update(device.id, { status: "Sold" });
      }
      await demoDb.sales.add(sale);
      await demoDb.saleCosts.add({ id, cost: money(cost), byProduct, unknownMaterialCost });
      for (const payment of input.payments)
        await demoDb.payments.add({
          id: newId(),
          code: await nextCode("TM-PAY-"),
          saleId: id,
          customerId: input.customerId,
          methodId: payment.methodId,
          amount: money(payment.amount),
          kind: "sale",
          reference: payment.reference,
          notes: "",
          employeeId: employee.id,
          createdAt: sale.createdAt,
          proof: payment.proof,
        });
      if (credit)
        await demoDb.ledger.add({
          id: newId(),
          customerId: input.customerId,
          reference: invoice,
          description: "Credit sale",
          saleId:id,
          debit: money(credit),
          credit: 0,
          employeeId: employee.id,
          createdAt: sale.createdAt,
        });
      if (cp) await demoDb.coupons.update(cp.id, { uses: cp.uses + 1 });
      if (test)
        await demoDb.testOuts.update(test.id, {
          status: "CONVERTED TO SALE",
          saleId: id,
        });
      for (const line of lines)
        if (line.approval)
          await audit(
            "price.override",
            "Sales",
            `${employee.name}: ${line.name} PKR ${line.originalPrice} → ${line.unitPrice}; ${line.reason}; approved by ${line.approval.managerName}`,
            invoice,
          );
      await audit(
        "sale.completed",
        "Sales",
        `${employee.name} sold ${lines[0].name}${lines.length > 1 ? ` and ${lines.length - 1} more items` : ""}`,
        invoice,
      );
      await demoDb.meta.add({ id: `checkout:${id}`, value: 1 });
      return sale;
    });
  }
  async void(id: string) {
    authorize("sales.void");
    await atomic(async () => {
      const sale = await this.get(id);
      requireValue(
        sale && sale.status !== "Voided",
        "Sale is unavailable or already voided.",
      );
      requireValue(
        !Object.values(sale.returned).some((q) => q > 0),
        "A sale with returns cannot be voided.",
      );
      for (const line of sale.lines)
        if (!line.service || line.material) {
          for (const allocation of line.material?.allocations ?? line.stockAllocations ?? [
            { locationId: line.locationId, quantity: line.quantity },
          ])
            await move(
              line.material?.productId??line.productId,
              allocation.locationId,
              allocation.quantity,
              "RETURN",
              sale.invoice,
              "Voided sale",
            );
          const device = await demoDb.devices
            .where("productId")
            .equals(line.productId)
            .first();
          if (device)
            await demoDb.devices.update(device.id, { status: "In Stock" });
        }
      const ledger = await demoDb.ledger
        .where("customerId")
        .equals(sale.customerId)
        .toArray();
      const credit = Math.max(0,Math.min(ledger.filter(l=>l.saleId===sale.id||!l.saleId&&l.reference===sale.invoice).reduce((s,l)=>s+l.debit-l.credit,0),ledger.reduce((s,l)=>s+l.debit-l.credit,0)));
      if (credit > 0)
        await demoDb.ledger.add({
          id: newId(),
          customerId: sale.customerId,
          reference: sale.invoice,
          description: "Void credit reversal",
          saleId:sale.id,
          debit: 0,
          credit,
          employeeId: actor().id,
          createdAt: new Date().toISOString(),
        });
      for (const p of sale.payments)
        await demoDb.payments.add({
          id: newId(),
          code: await nextCode("TM-PAY-"),
          saleId: id,
          customerId: sale.customerId,
          methodId: p.methodId,
          amount: p.amount,
          kind: "reversal",
          reference: sale.invoice,
          notes: "Voided sale",
          employeeId: actor().id,
          createdAt: new Date().toISOString(),
        });
      await demoDb.sales.update(id, { status: "Voided" });
      await audit(
        "sale.voided",
        "Sales",
        "Sale reversed without deleting its history",
        sale.invoice,
      );
    });
  }
  async returnItem(
    saleId: string,
    productId: string,
    quantity: number,
    reason: string,
    destination: ReturnRecord["destination"],
    approval?: string,
    options: ReturnOptions = {},
  ) {
    authorize("returns.create");
    return atomic(async () => {
      const payload=JSON.stringify({saleId,productId,quantity,reason,destination,approval,options});
      const cached=options.idempotencyKey?await demoDb.stockRequests.get(options.idempotencyKey):undefined;
      if(cached){requireValue(cached.kind==='return'&&cached.payload===payload,'This return request was already used for different values.');return cached.result as ReturnRecord;}
      const sale = await this.get(saleId);
      requireValue(
        sale && sale.status !== "Voided",
        "Select a valid original invoice.",
      );
      const settings = await demoDb.settings.get("main");
      requireValue(settings, "Settings unavailable.");
      requireValue(
        (Date.now() - Date.parse(sale.createdAt)) / 86400000 <=
          settings.returnDays,
        "Invoice is outside the configured return window.",
      );
      if (options.refundLabor) authorize('returns.approve');
      if (settings.returnApproval && !allowed('returns.approve')) {
        const manager = approval
          ? await demoDb.employees.get(approval)
          : undefined;
        requireValue(
          manager?.status === "active" &&
            (manager.role === "owner" ||
              manager.permissions.includes("returns.approve")),
          "Manager approval is required.",
        );
      }
      const line = sale.lines.find((l) => l.productId === productId);
      requireValue(line, "Item not found on invoice.");
      requireValue(
        Number.isInteger(quantity) &&
          quantity > 0 &&
          quantity <= line.quantity - (sale.returned[productId] ?? 0),
        "Return quantity exceeds the remaining sold quantity.",
      );
      requireValue(reason.trim(), "A return reason is required.");
      const previous=sale.returned[productId]??0;
      const portion=(total:number)=>money(money(total*(previous+quantity)/line.quantity)-money(total*previous/line.quantity));
      const amount = line.compound ? money(portion(line.compound.productTotal)+(options.refundLabor?portion(line.compound.laborTotal):0)) : portion(line.total);
      const taxAmount=line.compound?money(portion(line.compound.productTax)+(options.refundLabor?portion(line.compound.laborTax):0)):portion(line.taxAmount??0);
      const record: ReturnRecord = {
        refundLabor:!!options.refundLabor,
        taxAmount,
        locationId:options.locationId,
        condition:destination==='Damaged'?'Damaged':destination==='Sellable Stock'?'Available':'Not restored',
        ...(line.material?{material:{productId:line.material.productId,quantity:quantity*line.material.quantityPerService}}:{}),
        id: newId(),
        code: await nextCode("TM-RET-"),
        saleId,
        productId,
        quantity,
        reason,
        destination,
        amount,
        employeeId: actor().id,
        createdAt: new Date().toISOString(),
      };
      await demoDb.returns.add(record);
      if ((!line.service || line.material) && destination !== "Do Not Restore Stock") {
        const physicalProduct=line.material?.productId??productId,ratio=line.material?.quantityPerService??1;
        if(destination==='Damaged') await recordDamagedReturn(sale,line,record,quantity*ratio,options.locationId??'');
        else {
        if(options.locationId) requireValue((await conditionLocations('Available')).some(l=>l.locationId===options.locationId),'Select an active available-stock box.');
        let skip = (sale.returned[productId] ?? 0)*ratio;
        let remaining = quantity*ratio;
        for (const allocation of line.material?.allocations ?? line.stockAllocations ?? [
          { locationId: line.locationId, quantity: line.quantity },
        ]) {
          const omitted = Math.min(skip, allocation.quantity);
          skip -= omitted;
          const take = Math.min(remaining, allocation.quantity - omitted);
          if (!take) continue;
          await move(
            physicalProduct,
            options.locationId??allocation.locationId,
            take,
            "RETURN",
            record.code,
            reason,
          );
          remaining -= take;
        }
        requireValue(remaining===0,'The original physical stock allocation is incomplete.');
        }
      }
      const saleDebt=(await demoDb.ledger.where('customerId').equals(sale.customerId).toArray()).filter(l=>l.saleId===sale.id||!l.saleId&&l.reference===sale.invoice).reduce((sum,l)=>sum+l.debit-l.credit,0);
      const outstanding = (
        await demoDb.ledger
          .where("customerId")
          .equals(sale.customerId)
          .toArray()
      ).reduce((s, l) => s + l.debit - l.credit, 0);
      const creditRefund = Math.min(
        amount,
        Math.max(0, saleDebt),
        Math.max(0, outstanding),
      );
      if (creditRefund)
        await demoDb.ledger.add({
          id: newId(),
          customerId: sale.customerId,
          reference: sale.invoice,
          description: "Return credit reversal",
          saleId:sale.id,
          debit: 0,
          credit: creditRefund,
          employeeId: actor().id,
          createdAt: record.createdAt,
        });
      for (const payment of [
        { methodId: "credit", amount: creditRefund },
        { methodId: "cash", amount: money(amount - creditRefund) },
      ].filter((p) => p.amount > 0))
        await demoDb.payments.add({
          id: newId(),
          code: await nextCode("TM-PAY-"),
          saleId,
          customerId: sale.customerId,
          ...payment,
          kind: "refund",
          reference: record.code,
          notes: reason,
          employeeId: actor().id,
          createdAt: record.createdAt,
        });
      const returned = {
        ...sale.returned,
        [productId]: (sale.returned[productId] ?? 0) + quantity,
      };
      const device = await demoDb.devices
        .where("productId")
        .equals(productId)
        .first();
      if (
        device &&
        quantity === line.quantity &&
        destination !== "Do Not Restore Stock"
      )
        await demoDb.devices.update(device.id, {
          status:
            destination === "Sellable Stock" ? "In Stock" : "Repair Needed",
        });
      await demoDb.sales.update(saleId, {
        returned,
        status: sale.lines.every(
          (l) => (returned[l.productId] ?? 0) === l.quantity,
        )
          ? "Returned"
          : sale.status,
      });
      await audit(
        "return.created",
        "Sales",
        `${quantity} ${line.name} returned to ${destination}`,
        record.code,
      );
      if(options.idempotencyKey)await demoDb.stockRequests.add({id:options.idempotencyKey,kind:'return',payload,result:record});
      return record;
    });
  }
}
