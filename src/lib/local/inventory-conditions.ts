import type {
  DamageAction,
  DamagedStockEntry,
  ConditionMovement,
  StockOverview,
  StockCondition,
} from "../../types/inventory-conditions";
import type { ReturnRecord, Sale, SaleLine } from "../../types/demo";
import { demoDb, atomic, newId, requireValue } from "./database";
import { actor, authorize, allowed, audit, move } from "./common";

export async function conditionLocations(condition: StockCondition) {
  requireValue(
    allowed("inventory.view") || allowed("returns.create"),
    "You do not have permission to view stock destinations.",
  );
  const locations = await demoDb.locations.toArray();
  return locations
    .filter(
      (box) =>
        box.kind === "box" &&
        !box.archived &&
        (box.stockCondition ?? "Available") === condition &&
        locations.some(
          (s) =>
            s.id === box.parentId &&
            !s.archived &&
            s.kind === "shelf" &&
            locations.some(
              (r) => r.id === s.parentId && !r.archived && r.kind === "rack",
            ),
        ),
    )
    .map((box) => {
      const shelf = locations.find((l) => l.id === box.parentId)!,
        rack = locations.find((l) => l.id === shelf.parentId)!;
      return {
        locationId: box.id,
        path: [rack.name, shelf.name, box.name].join(" → "),
        stockCondition: condition,
      };
    });
}
export async function conditionBalance(lotId: string, locationId: string) {
  return (
    await demoDb.conditionMovements.where("lotId").equals(lotId).toArray()
  )
    .filter((m) => m.locationId === locationId)
    .reduce((sum, m) => sum + m.quantity, 0);
}
export async function damagedInventory(
  productId?: string,
): Promise<DamagedStockEntry[]> {
  authorize("inventory.view");
  const lots = (await demoDb.damagedLots.toArray()).filter(
      (l) => !productId || l.productId === productId,
    ),
    movements = await demoDb.conditionMovements.toArray(),
    locations = await demoDb.locations.toArray();
  const result: DamagedStockEntry[] = lots.flatMap((lot) => {
    const events = movements.filter((m) => m.lotId === lot.id);
    return [...new Set(events.map((m) => m.locationId))].map((locationId) => {
      const own = events.filter((m) => m.locationId === locationId),
        quantity = own.reduce((sum, m) => sum + m.quantity, 0),
        last = own.filter(event=>event.action!=='NOTE').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).at(-1);
      const box = locations.find((l) => l.id === locationId),
        shelf = locations.find((l) => l.id === box?.parentId),
        rack = locations.find((l) => l.id === shelf?.parentId);
      return {
        ...lot,
        quantity,
        locationId,
        locationPath: [rack?.name, shelf?.name, box?.name]
          .filter(Boolean)
          .join(" → "),
        events,
        photos: [
          ...new Set([
            ...(lot.photos ?? []),
            ...events.flatMap((m) => m.photos ?? []),
          ]),
        ],
        disposition:
          quantity > 0
            ? "Damaged"
            : last?.action === "RECOVER"
              ? "Recovered"
              : last?.action === "WRITE_OFF"
                ? "Written off"
                : "Transferred",
      };
    });
  });
  const legacy = (await demoDb.returns.toArray()).filter(
    (r) =>
      r.destination === "Damaged" &&
      !lots.some((l) => l.returnId === r.id) &&
      (!productId || r.productId === productId),
  );
  for (const row of legacy) {
    const sale = await demoDb.sales.get(row.saleId),
      line = sale?.lines.find((l) => l.productId === row.productId);
    result.push({
      id: "legacy:" + row.id,
      productId: row.productId,
      productName: line?.name ?? "Historical item",
      quantity: 0,
      returnedQuantity: row.quantity,
      quantityUnknown: true,
      historical: true,
      locationId: "",
      locationPath: "Location not recorded",
      saleId: row.saleId,
      returnId: row.id,
      invoice: sale?.invoice,
      customerId: sale?.customerId,
      customerName: sale?.customerName,
      employeeId: row.employeeId,
      employeeName:
        (await demoDb.employees.get(row.employeeId))?.full_name ?? "",
      reason: row.reason,
      createdAt: row.createdAt,
      disposition: "Unlocated historical",
    });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function inventoryConditions(
  productId?: string,
): Promise<StockOverview[]> {
  authorize("inventory.view");
  const products = (await demoDb.products.toArray()).filter(
    (p) => p.category !== "Services" && (!productId || p.id === productId),
  );
  const balances = await demoDb.balances.toArray(),
    events = await demoDb.conditionMovements.toArray(),
    tests = await demoDb.testOuts.where("status").equals("OUT").toArray();
  return products.map((product) => {
    const available = balances
        .filter((b) => b.productId === product.id)
        .reduce((sum, b) => sum + b.quantity, 0),
      damaged = events
        .filter((m) => m.productId === product.id)
        .reduce((sum, m) => sum + m.quantity, 0),
      outForTest = tests
        .filter((t) => t.productId === product.id)
        .reduce((sum, t) => sum + t.quantity, 0);
    return {
      productId: product.id,
      available,
      damaged,
      outForTest,
      totalPhysical: available + damaged + outForTest,
    };
  });
}
export async function recordDamagedReturn(
  sale: Sale,
  line: SaleLine,
  record: ReturnRecord,
  quantity: number,
  locationId: string,
) {
  const eligible = await conditionLocations("Damaged");
  requireValue(
    eligible.some((l) => l.locationId === locationId),
    "Select an active Damaged / Quarantine box.",
  );
  const productId = line.material?.productId ?? line.productId;
  const product = await demoDb.products.get(productId);
  requireValue(product, "The returned physical product is unavailable.");
  const id = newId(),
    employee = actor();
  await demoDb.damagedLots.add({
    id,
    productId,
    productName: product.name,
    quantity,
    returnedQuantity: quantity,
    locationId,
    locationPath: eligible.find((l) => l.locationId === locationId)!.path,
    saleId: sale.id,
    returnId: record.id,
    invoice: sale.invoice,
    customerId: sale.customerId,
    customerName: sale.customerName,
    employeeId: employee.id,
    employeeName: employee.name,
    reason: record.reason,
    createdAt: record.createdAt,
    disposition: "Damaged",
    photos: [],
  });
  await demoDb.conditionMovements.add({
    id: newId(),
    lotId: id,
    productId,
    locationId,
    quantity,
    action: "RETURN_DAMAGED",
    employeeId: employee.id,
    createdAt: record.createdAt,
    notes: record.reason,
  });
  await audit(
    "stock.damaged_returned",
    "Inventory",
    quantity + " " + product.name + " placed in quarantine",
    record.code,
  );
}
export async function damageAction(
  input: DamageAction,
): Promise<DamagedStockEntry[]> {
  authorize(
    input.action === "transfer" ? "inventory.transfer" : "inventory.adjust",
  );
  const payload = JSON.stringify(input);
  return atomic(async () => {
    const cached = await demoDb.stockRequests.get(input.idempotencyKey);
    if (cached) {
      requireValue(
        cached.kind === "damage" && cached.payload === payload,
        "This request was already used for different values.",
      );
      return cached.result as DamagedStockEntry[];
    }
    requireValue(
      input.idempotencyKey && input.notes.trim(),
      "Enter a reason for this stock action.",
    );
    const lot = await demoDb.damagedLots.get(input.lotId);
    requireValue(
      lot,
      "Historical or missing damage records cannot change tracked stock.",
    );
    const balance = await conditionBalance(input.lotId, input.sourceLocationId);
    requireValue(
      Number.isInteger(input.expectedQuantity) &&
        balance === input.expectedQuantity,
      "Damaged stock changed. Refresh and try again.",
    );
    requireValue(
      ["transfer", "recover", "write-off", "note"].includes(input.action),
      "Choose a valid condition action.",
    );
    if (input.action !== "note")
      requireValue(
        Number.isInteger(input.quantity) &&
          input.quantity > 0 &&
          input.quantity <= balance,
        "Enter a quantity within the damaged balance.",
      );
    const now = new Date().toISOString(),
      employee = actor();
    const event = async (
      action: ConditionMovement["action"],
      locationId: string,
      quantity: number,
    ) =>
      demoDb.conditionMovements.add({
        id: newId(),
        lotId: lot.id,
        productId: lot.productId,
        locationId,
        quantity,
        action,
        employeeId: employee.id,
        createdAt: now,
        notes: input.notes,
        photos: input.photos,
      });
    if (input.action === "transfer" || input.action === "recover") {
      requireValue(
        input.destinationId && input.destinationId !== input.sourceLocationId,
        "Select a different destination box.",
      );
      const condition = input.action === "transfer" ? "Damaged" : "Available";
      const locations = await conditionLocations(condition);
      requireValue(
        locations.some((l) => l.locationId === input.destinationId),
        "Select an active " + condition + " destination box.",
      );
      await event(
        input.action === "transfer" ? "TRANSFER_OUT" : "RECOVER",
        input.sourceLocationId,
        -input.quantity,
      );
      if (input.action === "transfer")
        await event("TRANSFER_IN", input.destinationId, input.quantity);
      else {
        await move(
          lot.productId,
          input.destinationId,
          input.quantity,
          "ADJUSTMENT",
          input.idempotencyKey,
          "Inspected damage recovery: " + input.notes,
        );
        const device = await demoDb.devices
          .where("productId")
          .equals(lot.productId)
          .first();
        if (device)
          await demoDb.devices.update(device.id, { status: "In Stock" });
      }
    } else
      await event(
        input.action === "write-off" ? "WRITE_OFF" : "NOTE",
        input.sourceLocationId,
        input.action === "write-off" ? -input.quantity : 0,
      );
    await audit(
      "stock.damage_" + input.action,
      "Inventory",
      input.quantity + " " + lot.productName + ": " + input.notes,
      input.idempotencyKey,
    );
    const result = await damagedInventory(lot.productId);
    await demoDb.stockRequests.add({
      id: input.idempotencyKey,
      kind: "damage",
      payload,
      result,
    });
    return result;
  });
}
