import type { Repositories, EditableRepository } from "../repositories/interfaces";
import type { DemoEmployee, Supplier, DevicePurchase, AuditEvent, RepairJob, Shift, RepairService } from "../../types/demo";
import { ApiProductRepository, ApiLocationRepository, ApiInventoryRepository, read, write } from "./catalog-repositories";
import { apiSales, apiCustomers, apiCredit, apiPayments, apiCoupons, apiSettings, apiReports } from "./transaction-repositories";
import { apiMediaUrls, apiStoreMedia } from "./media";
const generic = <T extends { id: string }>(path: string): EditableRepository<T> => ({ list: () => read<T[]>(path), async get(id) { return (await this.list()).find(r => r.id === id); }, save: input => write<T>(path, input) });
const products = new ApiProductRepository();
export const apiRepositories: Repositories = {
  products, locations: new ApiLocationRepository(), inventory: new ApiInventoryRepository(),
  sales: apiSales, customers: apiCustomers, credit: apiCredit, payments: apiPayments, coupons: apiCoupons, settings: apiSettings, reports: apiReports,
  employees: {
    ...generic<DemoEmployee>("/employees"),
    async save(e) { await write("/employees", { id: e.id, full_name: e.full_name, phone: e.phone, email: e.email, role: e.role, status: e.status, permissions: e.permissions }); window.dispatchEvent(new Event("taha-session-refresh")); return e; },
    async updateOwnProfile(fullName, phone) { await write("/profile", { fullName, phone }, "PATCH"); window.dispatchEvent(new Event("taha-session-refresh")); },
    async setPermissions(id, permissions) { await write(`/employees/${id}/permissions`, { permissions }, "PUT"); window.dispatchEvent(new Event("taha-session-refresh")); },
  },
  suppliers: generic<Supplier>("/suppliers"),
  audit: { async list() { const rows = await read<{ id: string; actor_profile_id: string; action: string; entity_type: string; entity_id: string; created_at: string }[]>("/audit"); return rows.map(e => ({ id: e.id, employeeId: e.actor_profile_id, employeeName: "Internal team", action: e.action, module: e.entity_type, description: e.action.replaceAll(".", " · ").replaceAll("_", " "), reference: e.entity_id, createdAt: e.created_at } satisfies AuditEvent)); }, async get(id) { return (await this.list()).find(e => e.id === id); } },
  services: {...generic<RepairService>("/services"), materialLocations: id => read("/services/material-locations/"+encodeURIComponent(id))},
  devices: {
    async list() { const rows = await read<DevicePurchase[]>("/devices"); const urls = await apiMediaUrls(rows.flatMap(d => d.photos)); return rows.map(d => ({...d,photoPaths:d.photos,photos:d.photos.map(path => urls[path] ?? "")})); },
    async get(id) { return (await this.list()).find(d => d.id === id); },
    async purchase(input, locationId) { const photos = await Promise.all(input.photos.map((url,i) => apiStoreMedia(url,"device",input.photoPaths?.[i],input.id,undefined,String(i)))); const saved = await write<DevicePurchase>("/devices", { ...input, photos, locationId, idempotencyKey: input.id }); return {...saved,photos:input.photos,photoPaths:photos}; },
    async updateStatus(id, status) { await write(`/devices/${id}`, { status }, "PATCH"); },
  },
  jobs: {
    async list() { const rows = await read<RepairJob[]>("/repair-jobs"); const urls = await apiMediaUrls(rows.flatMap(r => r.photos)); return rows.map(row => ({...row,photoPaths:row.photos,photos:row.photos.map(p => urls[p] ?? "")})); },
    async get(id) { return (await this.list()).find(r => r.id === id); },
    async save(input) {
      const photos = await Promise.all(input.photos.map((url,i) => apiStoreMedia(url,"repair",input.photoPaths?.[i],input.id,undefined,String(i))));
      const { id, code, customerId, customerName, phone, device, imei, problem, damage, photoCategories, estimate, advance, technicianId, notes, status } = input;
      await write("/repair-jobs",{id,code,customerId,customerName,phone,device,imei,problem,damage,photos,photoCategories,estimate,advance,technicianId,notes,status});
      return (await this.get(input.id))!;
    },
  },
  shifts: { ...generic<Shift>("/shifts"), closing: id => read(`/shifts/${id}/closing`), async close(id, counted, expenses, notes) { await write(`/shifts/${id}/close`, { counted, expenses, notes }); } },
  website: { products: () => read("/website/products"), async saveProduct(input) { await write("/website/products", input); }, enquiries: generic("/website/enquiries"), convert: id => write(`/website/enquiries/${id}/convert`, {}) },
  async reset() { throw new Error("Live business data cannot be reset from the application."); },
};
