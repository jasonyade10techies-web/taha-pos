import {cachedCounterRead} from './read-cache';
import {nativeDesktop} from '../desktop/runtime';
import {useSyncStore} from '../../stores/sync-store';
import type { ProductRepository, LocationRepository, InventoryRepository } from "../repositories/interfaces";
import type { ProductInput, Location, ReceiveDraft } from "../../types/demo";
import type { ProductRow, PosProductRow, LocationRow, StockMovementRow } from "../../types/database";
import { productModel, posModel, locationModel, movementModel } from "../supabase/mappers";
import { apiRequest } from "./client";
import { apiMediaUrls, apiStoreMedia, storePath } from "./media";
import { apiGallery, saveGallery } from "./gallery";
import { useSessionStore } from "../../stores/session-store";
import { permitted } from "../../features/auth/services/permission-service";
import type {StockOverview,StockCondition,ConditionLocation,DamagedStockEntry,DamageAction} from '../../types/inventory-conditions';
export const read = <T>(path: string) => apiRequest<T>(`${storePath()}${path}`);
// Bootstrap/recovery takes one snapshot; subsequent native POS reads use revision-updated SQLite.
export const refreshPosCatalogue = () => cachedCounterRead("pos-products", () => read<PosProductRow[]>("/products/pos"));
export const write = async <T>(path: string, input: unknown, method = "POST") => {if(nativeDesktop&&useSyncStore.getState().status==='OFFLINE')throw new Error('This action requires a connection to the shop. Offline mode supports cached cash sales only.');const result = await apiRequest<T>(`${storePath()}${path}`, { method, body: JSON.stringify(input) }); window.dispatchEvent(new Event("taha-remote-changed")); return result; };
export class ApiProductRepository implements ProductRepository {
  saveValue = (kind: string, value: string) => write<{id:string;kind:string;value:string}>("/products/values", {kind,value});
  values = () => read<{ id?:string; kind: string; value: string }[]>("/products/values");
  async list() { const rows = await cachedCounterRead("products",()=>read<ProductRow[]>("/products")); const images = await apiMediaUrls(rows.map(r => r.primary_image_url ?? "")); return rows.map(row => productModel(row, images[row.primary_image_url ?? ""])); }
  async get(id: string) { const row = await cachedCounterRead(`product:${id}`,()=>read<ProductRow | null>(`/products/${id}`)); if (!row) return undefined; const [gallery, images] = await Promise.all([cachedCounterRead(`gallery:${id}`,()=>apiGallery("product", id)), apiMediaUrls([row.primary_image_url ?? ""])]); return { ...productModel(row, images[row.primary_image_url ?? ""]), gallery }; }
  async pos() { const rows = await cachedCounterRead("pos-products",()=>read<PosProductRow[]>("/products/pos"), nativeDesktop); const images = await apiMediaUrls(rows.map(r => r.primary_image_url ?? "")); return rows.map(row => posModel(row, images[row.primary_image_url ?? ""])); }
  async cost(id: string) {
    const { profile, permissions } = useSessionStore.getState();
    if (!permitted(profile, permissions, "costs.view_purchase_cost")) return null;
    const row = await read<{ purchase_cost: number } | number | null>(`/products/${id}/cost`);
    return row === null ? null : Number(typeof row === "number" ? row : row.purchase_cost);
  }
  async save(input: ProductInput) {
    const id = input.id ?? input.draftRequestId ?? crypto.randomUUID();
    const gallery = input.gallery ? await saveGallery(input.gallery, "product", id, true) : undefined;
    const image = gallery ? gallery[0]?.path ?? "" : await apiStoreMedia(input.image, "product", input.imagePath, id);
    const row = await write<ProductRow>("/products", { id, ...(gallery?{media_paths:gallery.map(image=>image.path)}:{}), description_html: input.description ?? "", supplier_id: input.supplierId || null, visibility: input.visibility ?? "store", tags: input.tags ?? [], state: input.state, name: input.name, category: input.category, brand: input.brand, compatible_model: input.compatibleModel, quality_grade: input.qualityGrade, color_variant: input.color, variant: input.variant, unit: input.unit, selling_price: input.sellingPrice, minimum_selling_price: input.minimumSellingPrice, aliases: input.aliases, notes: input.notes, low_stock_level: input.lowStockLevel, primary_image_url: image || null, default_location_id: input.locationId || null, initial_quantity: input.initialQuantity, initial_condition: input.initialCondition ?? "Available", expected_updated_at: input.updatedAt ?? null, ...(input.purchaseCost === undefined ? {} : { purchase_cost: input.purchaseCost }) });
    return { ...productModel(row, input.image), gallery };
  }
  async duplicate(id: string) { return productModel(await write<ProductRow>(`/products/${id}/duplicate`, {})); }
  async archive(id: string) { await write(`/products/${id}`, {}, "DELETE"); }
}
export class ApiLocationRepository implements LocationRepository {
  async list() { return (await cachedCounterRead("locations",()=>read<LocationRow[]>("/locations"))).map(locationModel); }
  async get(id: string) { return (await this.list()).find(l => l.id === id); }
  async path(id: string) { const all = await this.list(), seen = new Set<string>(), names: string[] = []; let location = all.find(l => l.id === id); while (location && !seen.has(location.id)) { seen.add(location.id); names.unshift(location.name); location = all.find(l => l.id === location!.parentId); } return names.join(" → "); }
  async save(l: Location) { return locationModel(await write<LocationRow>("/locations", { id: l.id, name: l.name, kind: l.kind, stockCondition:l.stockCondition??'Available', parent_id: l.parentId || null, expected_updated_at: l.updatedAt ?? null })); }
  async archive(id: string) { await write(`/locations/${id}`, {}, "DELETE"); }
  balances = () => new ApiInventoryRepository().balances();
}
export class ApiInventoryRepository implements InventoryRepository {
  conditions=(productId?:string)=>read<StockOverview[]>('/inventory/conditions'+(productId?'?productId='+encodeURIComponent(productId):''));
  conditionLocations=(condition:StockCondition)=>read<ConditionLocation[]>('/inventory/condition-locations?condition='+condition);
  async damaged(productId?:string) {return this.damagePhotos(await read<DamagedStockEntry[]>('/inventory/damaged'+(productId?'?productId='+encodeURIComponent(productId):'')));}
  private async damagePhotos(rows:DamagedStockEntry[]){const urls=await apiMediaUrls(rows.flatMap(row=>row.photos??[]));return rows.map(row=>({...row,photoPaths:row.photos,photos:(row.photos??[]).map(path=>urls[path]).filter(Boolean)}));}
  async damageAction(input:DamageAction){const photos=await Promise.all((input.photos??[]).map(photo=>apiStoreMedia(photo,'damage','',input.lotId)));return this.damagePhotos(await write<DamagedStockEntry[]>('/inventory/damaged/actions',{...input,photos}));}
  async balances() { return (await cachedCounterRead("stock-balances",()=>read<{ product_id: string; location_id: string; quantity: number }[]>("/inventory/balances"))).map(b => ({ id: `${b.product_id}:${b.location_id}`, productId: b.product_id, locationId: b.location_id, quantity: Number(b.quantity) })); }
  async movements() { return (await read<StockMovementRow[]>("/inventory/movements")).map(movementModel); }
  async drafts():Promise<ReceiveDraft[]> {
    const data=await read<{receipts:{id:string;supplier_id:string;reference:string;received_date:string;status:ReceiveDraft['status'];created_at:string}[];lines:{receipt_id:string;line_no:number;product_id:string;location_id:string;quantity:number;condition?:"Available"|"Damaged"}[];costs:{receipt_id:string;line_no:number;purchase_cost:number}[]}>("/inventory/receipts");
    return data.receipts.map(receipt=>({id:receipt.id,supplierId:receipt.supplier_id,reference:receipt.reference,date:receipt.received_date,status:receipt.status,createdAt:receipt.created_at,lines:data.lines.filter(line=>line.receipt_id===receipt.id).sort((a,b)=>a.line_no-b.line_no).map(line=>({productId:line.product_id,locationId:line.location_id,quantity:Number(line.quantity),condition:line.condition??"Available",cost:data.costs.find(cost=>cost.receipt_id===receipt.id && cost.line_no===line.line_no)?.purchase_cost===undefined?undefined:Number(data.costs.find(cost=>cost.receipt_id===receipt.id && cost.line_no===line.line_no)!.purchase_cost)}))}));
  }
  async saveDraft(input: ReceiveDraft) { await this.save(input, false); }
  async receive(input: ReceiveDraft) { await this.save(input, true); }
  private async save(d: ReceiveDraft, receive: boolean) { const session=useSessionStore.getState();const canCost=permitted(session.profile,session.permissions,'costs.view_purchase_cost');await write("/inventory/receipts", { receive, input: { id: d.id, supplier_id: d.supplierId, reference: d.reference, date: d.date, lines: d.lines.map(l => ({ product_id: l.productId, location_id: l.locationId, quantity: l.quantity, condition:l.condition??"Available", ...(canCost && l.cost!==undefined ? {purchase_cost:l.cost} : {}) })) } }); }
  async transfer(productId: string, source: string, destination: string, quantity: number) { await write("/inventory/transfer", { productId, source, destination, quantity, requestId: crypto.randomUUID() }); }
  async adjust(productId: string, locationId: string, expected: number, quantity: number, reason: string) { await write("/inventory/adjust", { productId, locationId, expected, quantity, reason, requestId: crypto.randomUUID() }); }
}
