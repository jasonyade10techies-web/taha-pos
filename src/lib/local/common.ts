import type { Table } from "dexie";
import {
  demoDb,
  atomic,
  newId,
  requireValue,
  money,
  nextCode,
} from "./database";
import { useSessionStore } from "../../stores/session-store";
import { permitted } from "../../features/auth/services/permission-service";
import type { PermissionKey } from "../../types/auth";
import type { EditableRepository } from "../repositories/interfaces";
import type { Movement } from "../../types/demo";
export function allowed(key: PermissionKey) {
  const s = useSessionStore.getState();
  return permitted(s.profile, s.permissions, key);
}
export function authorize(key: PermissionKey) {
  requireValue(allowed(key), "You do not have permission for this action.");
}
export const actor = () => useSessionStore.getState().employee;
export async function audit(
  action: string,
  module: string,
  description: string,
  reference = "",
) {
  const employee = actor();
  await demoDb.audit.add({
    id: newId(),
    employeeId: employee.id,
    employeeName: employee.name,
    action,
    module,
    description,
    reference,
    createdAt: new Date().toISOString(),
  });
}
export async function move(
  productId: string,
  locationId: string,
  quantity: number,
  type: Movement["type"],
  reference: string,
  notes = "",
) {
  requireValue(
    Number.isInteger(quantity) && quantity !== 0,
    "Enter a valid whole quantity.",
  );
  const location = await demoDb.locations.get(locationId);
  if (location?.archived && ["RETURN", "TEST_RETURN"].includes(type)) {
    await demoDb.locations.update(locationId, { archived: false });
    await audit(
      "location.restored",
      "Inventory",
      "Location reactivated for a stock return",
      location.code,
    );
    location.archived = false;
  }
  requireValue(
    location && !location.archived && location.kind === "box",
    "Select an active destination box.",
  );
  requireValue((location.stockCondition??'Available')==='Available','Damaged / Quarantine stock requires a classified condition action.');
  const id = `${productId}:${locationId}`;
  const row = await demoDb.balances.get(id);
  const next = (row?.quantity ?? 0) + quantity;
  const settings = await demoDb.settings.get("main");
  requireValue(
    next >= 0 || settings?.negativeStock,
    "There is not enough available stock at this location.",
  );
  await demoDb.balances.put({ id, productId, locationId, quantity: next });
  await demoDb.movements.add({
    id: newId(),
    productId,
    locationId,
    quantity,
    type,
    reference,
    employeeId: actor().id,
    notes,
    createdAt: new Date().toISOString(),
  });
}
export function editable<T extends { id: string }>(
  table: Table<T, string>,
  module: string,
  key: PermissionKey | readonly PermissionKey[],
  validate?: (value: T) => void,
  codePrefix?: string,
): EditableRepository<T> {
  return {
    list: () => table.toArray(),
    get: (id) => table.get(id),
    save: async (value) => {
      authorize(typeof key === "string" ? key : (key.find(allowed) ?? key[0]));
      validate?.(value);
      return atomic(async () => {
        if (codePrefix && "code" in value && !value.code) {
          Object.assign(value, { code: await nextCode(codePrefix) });
        }
        await table.put(value);
        await audit(
          "record.saved",
          module,
          `${module} details saved`,
          value.id,
        );
        return value;
      });
    },
  };
}
export function amount(value: number, label = "Amount") {
  requireValue(
    Number.isFinite(value) && value >= 0,
    `${label} must be zero or greater.`,
  );
  return money(value);
}
export function validDate(value: string) {
  return value && Number.isFinite(Date.parse(value));
}
