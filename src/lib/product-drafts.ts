import Dexie, { type Table } from "dexie";
import type { ProductInput } from "../types/demo";
import { useSessionStore } from "../stores/session-store";
import { repositories } from "./repositories";
export interface ProductDraft {
  id: string;
  scope: string;
  input: ProductInput;
  status: "Pending Sync" | "Conflict" | "Failed";
  error?: string;
  updatedAt: string;
}
class DraftDatabase extends Dexie {
  drafts!: Table<ProductDraft, string>;
  constructor() {
    super("taha-product-drafts");
    this.version(1).stores({ drafts: "id,scope,status,updatedAt" });
  }
}
export const productDraftDb = new DraftDatabase();
const scope = () => {
  const session = useSessionStore.getState();
  return `${session.context?.store?.id ?? "unknown-store"}:${session.profile?.id ?? ""}`;
};
export async function saveProductDraft(input: ProductInput) {
  const id = input.id ?? input.draftRequestId ?? crypto.randomUUID();
  await productDraftDb.drafts.put({
    id,
    scope: scope(),
    input: { ...input, draftRequestId: id },
    status: "Pending Sync",
    updatedAt: new Date().toISOString(),
  });
  window.dispatchEvent(new Event("taha-drafts-changed"));
  return id;
}
export async function getProductDraft(id: string) {
  const draft = await productDraftDb.drafts.get(id);
  return draft?.scope === scope() ? draft : undefined;
}
export async function removeProductDraft(id: string) {
  if (await getProductDraft(id)) await productDraftDb.drafts.delete(id);
  window.dispatchEvent(new Event("taha-drafts-changed"));
}
export const listProductDrafts = () =>
  productDraftDb.drafts.where("scope").equals(scope()).toArray();
let synchronizing = false;
export async function syncProductDrafts() {
  if (synchronizing || !navigator.onLine || !useSessionStore.getState().profile)
    return;
  synchronizing = true;
  try {
    for (const draft of await listProductDrafts()) {
      if (draft.status === "Conflict") continue;
      try {
        await repositories.products.save({
          ...draft.input,
          id: draft.input.id,
        });
        await productDraftDb.drafts.delete(draft.id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not synchronize this product.";
        await productDraftDb.drafts.update(draft.id, {
          status: /changed|conflict|updated|another/i.test(message)
            ? "Conflict"
            : "Failed",
          error: message,
        });
      }
    }
  } finally {
    synchronizing = false;
    window.dispatchEvent(new Event("taha-drafts-changed"));
  }
}
