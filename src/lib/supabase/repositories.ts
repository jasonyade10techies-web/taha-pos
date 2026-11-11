import type { Repositories } from "../repositories/interfaces";
import {
  SupabaseProductRepository,
  SupabaseLocationRepository,
  SupabaseInventoryRepository,
} from "./catalog-repositories";
import {
  remoteEmployees,
  remoteSuppliers,
  remoteAudit,
} from "./team-repositories";
import { remoteSales,remoteCustomers,remoteCredit,remotePayments,remoteCoupons,remoteSettings,remoteReports } from "./transaction-repositories";
import {remoteDevices} from "./device-repository";

const pending = async (): Promise<never> => {
  throw new Error(
    "This workflow is not connected yet. Use explicit Local Demo mode to preview it.",
  );
};
// Deliberately deny all unfinished contracts. No fallback to IndexedDB in live mode.
const pendingRepository = new Proxy({}, { get: () => pending });
const products = new SupabaseProductRepository();
export const supabaseRepositories: Repositories = {
  products,
  locations: new SupabaseLocationRepository(),
  inventory: new SupabaseInventoryRepository(),
  employees: remoteEmployees,
  suppliers: remoteSuppliers,
  audit: remoteAudit,
  ...(Object.fromEntries(
    [
      "shifts",
      "jobs",
    ].map((k) => [k, pendingRepository]),
  ) as Pick<
    Repositories,
    | "shifts"
    | "jobs"
  >),
  website: {
    products: pending,
    saveProduct: pending,
    enquiries: pendingRepository as Repositories["website"]["enquiries"],
    convert: pending,
  },
  sales:remoteSales, customers:remoteCustomers, credit:remoteCredit, payments:remotePayments,
  devices:remoteDevices,
  coupons:remoteCoupons, settings:remoteSettings, reports:remoteReports,
  services: {
    async list() { return (await products.pos()).filter(p=>p.category==="Services").map(p=>({id:p.id,code:p.internalCode,name:p.name,category:"Services",sellingPrice:p.sellingPrice,minimumSellingPrice:p.minimumSellingPrice,active:true,notes:""})); },
    async get(id) {return (await this.list()).find(p=>p.id===id);},
    async save(s) {
      const old = await products.get(s.id);
      const saved = await products.save({id:s.id,name:s.name,category:"Services",brand:"",compatibleModel:"",qualityGrade:"",color:"",sellingPrice:s.sellingPrice,minimumSellingPrice:s.minimumSellingPrice,aliases:[],lowStockLevel:0,state:s.active?"active":"archived",locationId:"",variant:"",unit:"Service",notes:s.notes,image:"",initialQuantity:0,updatedAt:old?.updatedAt});
      return {...s,id:saved.id,code:saved.internalCode};
    },
  },
  reset: pending,
};
