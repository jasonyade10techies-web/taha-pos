import { demoDb, atomic, requireValue } from "../local/database";
import { seedDemo } from "../local/seed";
import {
  LocalProductRepository,
  LocalInventoryRepository,
  LocalLocationRepository,
  localServices,
} from "../local/catalog-repositories";
import { LocalSalesRepository, localCoupons } from "../local/sales-repository";
import {
  LocalCreditRepository,
  LocalDevicePurchaseRepository,
  LocalShiftRepository,
  LocalReportRepository,
  localCustomers,
  localWebsite,
  localJobs,
} from "../local/business-repositories";
import { editable, authorize, audit, amount, actor } from "../local/common";
import type { Repositories } from "./interfaces";
import { apiRepositories } from "../api/repositories";
import { apiEnabled, localDemoEnabled } from "../config";
import { supabaseRepositories } from "../supabase/repositories";
import {shopConfiguration} from '../../types/shop-configuration';
import {useSyncStore} from '../../stores/sync-store';
import {useSessionStore} from '../../stores/session-store';

// Application composition seam: pages import this contract, never Dexie or seed arrays.
const localRepositories: Repositories = {
  products: new LocalProductRepository(),
  inventory: new LocalInventoryRepository(),
  locations: new LocalLocationRepository(),
  sales: new LocalSalesRepository(),
  customers: localCustomers,
  credit: new LocalCreditRepository(),
  services: localServices,
  devices: new LocalDevicePurchaseRepository(),
  shifts: new LocalShiftRepository(),
  reports: new LocalReportRepository(),
  website: localWebsite,
  jobs: localJobs,
  suppliers: editable(demoDb.suppliers, "Suppliers", "inventory.receive", (s) =>
    requireValue(s.name.trim(), "Supplier name is required."),
  ),
  employees: {
    async setPermissions(id, permissions) {
      authorize("employees.permissions");
      await atomic(async () => {
        const employee = await demoDb.employees.get(id);
        requireValue(
          employee && employee.role !== "owner",
          "Select a non-owner employee.",
        );
        await demoDb.employees.update(id, { permissions });
        await audit(
          "employee.permissions_updated",
          "Employees",
          "Explicit permissions updated",
          id,
        );
      });
    },
    async updateOwnProfile(name, phone) {
      requireValue(name.trim(), "Your name is required.");
      await atomic(async () => {
        const employee = await demoDb.employees.get(actor().id);
        requireValue(
          employee?.status === "active",
          "An active local employee is required.",
        );
        await demoDb.employees.update(employee.id, {
          full_name: name.trim(),
          phone: phone.trim(),
        });
        await audit(
          "profile.updated",
          "Employees",
          "Own profile updated",
          employee.id,
        );
      });
    },
    ...editable(demoDb.employees, "Employees", "employees.manage", (e) =>
      requireValue(e.full_name.trim(), "Employee name is required."),
    ),
    async save(value) {
      authorize("employees.manage");
      const old = await demoDb.employees.get(value.id);
      if (value.id === "owner-1")
        requireValue(
          value.role === "owner" && value.status === "active",
          "The demo owner must remain active.",
        );
      if (
        JSON.stringify(old?.permissions) !== JSON.stringify(value.permissions)
      )
        authorize("employees.permissions");
      return atomic(async () => {
        await demoDb.employees.put(value);
        await audit(
          "employee.saved",
          "Employees",
          `${value.full_name} profile or permissions updated`,
          value.id,
        );
        return value;
      });
    },
  },
  payments: {
    ...editable(demoDb.paymentMethods, "Payments", "settings.manage", (p) =>
      requireValue(p.name.trim(), "Payment method name is required."),
    ),
    entries: () => demoDb.payments.orderBy("createdAt").reverse().toArray(),
  },
  coupons: localCoupons,
  audit: {
    list: () => demoDb.audit.orderBy("createdAt").reverse().toArray(),
    get: (id) => demoDb.audit.get(id),
  },
  settings: {
    async get() {
      const s = await demoDb.settings.get("main");
      requireValue(s, "Demo settings unavailable.");
      return { mobileCameraRequireProof:s.requireProof, customerDisplayFullscreen:false, customerDisplayIdleTimeout:12, customerDisplayPromotions:true, customerDisplayPaymentQr:true, mobileCameraEnabled:true, mobileCameraCompressImages:true, mobileCameraImageQuality:82, keyboardEnabled:true, keyboardOpenOnTouch:false, keyboardNumericAmounts:true, keyboardSize:"Compact" as const, defaultSaleCustomer:"Walk-in Customer", showRecentCustomers:true, allowQuickAddCustomer:true, requirePhoneForCredit:true, ...s };
    },
    async save(settings) {
      authorize("settings.manage");
      const previous=shopConfiguration((await demoDb.settings.get('main'))?.shopConfiguration),next=shopConfiguration(settings.shopConfiguration);
      if(previous.operatingMode!==next.operatingMode){
        requireValue(useSessionStore.getState().profile?.role==='owner','Only the owner can change shop operating mode.');
        requireValue(!(await demoDb.shifts.toArray()).some(s=>s.status==='Open'),'Close active shifts before changing shop operating mode.');
        requireValue(!useSyncStore.getState().pending.some(p=>p.status!=='SYNCED'),'Synchronize or resolve pending counter changes first.');
      }
      requireValue(
        settings.storeName.trim() && settings.branch.trim(),
        "Store and branch are required.",
      );
      amount(settings.returnDays, "Return window");
      await atomic(async () => {
        await demoDb.settings.put({...settings,shopConfiguration:next});
        await audit("settings.saved", "Settings", "Workspace settings updated");
      });
    },
  },
  async reset() {
    authorize("settings.manage");
    await seedDemo(true);
    window.dispatchEvent(new Event("taha-demo-reset"));
    window.dispatchEvent(new Event("taha-demo-changed"));
  },
};
export const repositories = localDemoEnabled
  ? localRepositories
  : apiEnabled ? apiRepositories : supabaseRepositories;
export const initializeDemo = () =>
  localDemoEnabled ? seedDemo() : Promise.resolve();
