import Fuse from "fuse.js";
import type { QueryClient } from "@tanstack/react-query";
import type { PermissionKey, Profile } from "../../types/auth";
import type { Location } from "../../types/demo";
import { canOpenRoute } from "../../features/auth/route-access";
import { permitted } from "../../lib/permissions";
import { repositories } from "../../lib/repositories";
import { dataProvider } from "../../lib/config";
import { searchProducts } from "../../lib/product-search";
import { currency } from "../../lib/utils";
import { shopTimestamp } from "../../lib/shop-time";
import { allNavigation } from "./navigation-data";

export type SearchGroup = "Products" | "Customers" | "Receipts" | "Services" | "Locations" | "Pages";
export type WorkspaceResult = { id: string; group: SearchGroup; title: string; description: string; path: string };
export type SearchAccess = { profile: Profile | null; permissions: PermissionKey[]; storeId: string };
export const searchGroups: SearchGroup[] = ["Products", "Customers", "Receipts", "Services", "Locations", "Pages"];
const cap = 4;

export function pageResults(query: string, access: SearchAccess): WorkspaceResult[] {
  const pages = allNavigation.filter(item => canOpenRoute(item.path, access.profile, access.permissions));
  const matching = query.trim()
    ? new Fuse(pages, { keys: ["label", "description"], threshold: .3, ignoreLocation: true }).search(query.trim()).map(result => result.item)
    : pages;
  return matching.slice(0, 8).map(item => ({ id: "page:" + item.path, group: "Pages", title: item.label, description: item.description, path: item.path }));
}

function locationPath(location: Location, locations: Location[]) {
  const names = [location.name], seen = new Set([location.id]);
  let parent = locations.find(item => item.id === location.parentId);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id); names.unshift(parent.name);
    parent = locations.find(item => item.id === parent!.parentId);
  }
  return names.join(" → ");
}

function matching<T>(rows: T[], query: string, keys: string[]) {
  return new Fuse(rows, { keys, threshold: .3, ignoreLocation: true }).search(query.trim()).map(result => result.item).slice(0, cap);
}

/** Read existing authorized projections only. No writes or financial actions originate here. */
export async function searchWorkspace(query: string, access: SearchAccess, cache: QueryClient) {
  const canOpen = (path: string) => canOpenRoute(path, access.profile, access.permissions);
  const scope = [dataProvider, access.profile?.id, access.storeId, [...access.permissions].sort().join(",")];
  const cached = <T>(key: string, read: () => Promise<T>) => cache.fetchQuery({ queryKey: [...scope, "workspace-search", key], queryFn: read, staleTime: 30_000, retry: false });
  const tasks: { group: SearchGroup; read: () => Promise<WorkspaceResult[]> }[] = [];
  if (canOpen("/products")) tasks.push({ group: "Products", read: async () => {
    const products = await cached("products", () => repositories.products.pos());
    return searchProducts(products.filter(product => product.category !== "Services"), query).slice(0, cap).map(product => ({
      id: "product:" + product.id, group: "Products", title: product.name,
      description: [product.internalCode, `${product.quantity} available`, product.location && [product.location.rack, product.location.shelf, product.location.box].filter(Boolean).join(" → ")].filter(Boolean).join(" · "),
      path: "/products/" + encodeURIComponent(product.id),
    }));
  } });
  if (canOpen("/customers")) tasks.push({ group: "Customers", read: async () => {
    const customers = await cached("customers", () => repositories.customers.list());
    const canCredit = permitted(access.profile, access.permissions, "credit.create") || permitted(access.profile, access.permissions, "credit.receive_payment");
    const digits = query.replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "92");
    const exactPhone = digits.length >= 5 ? customers.filter(customer => customer.phone.replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "92").includes(digits)) : [];
    const rows = [...exactPhone, ...matching(customers, query, ["name", "shopName", "phone", "id"])];
    return [...new Map(rows.map(customer => [customer.id, customer])).values()].slice(0, cap).map(customer => ({
      id: "customer:" + customer.id, group: "Customers", title: customer.name,
      description: [customer.phone, customer.shopName, canCredit && customer.outstanding !== undefined ? `Outstanding ${currency(customer.outstanding)}` : ""].filter(Boolean).join(" · "),
      path: "/customers/" + encodeURIComponent(customer.id),
    }));
  } });
  if (canOpen("/transactions") && repositories.sales.page) tasks.push({ group: "Receipts", read: async () => {
    const page = await cached("receipts:" + query.trim().toLowerCase(), () => repositories.sales.page!({ search: query.trim(), page: 0, limit: cap }));
    return page.rows.slice(0, cap).map(sale => ({ id: "receipt:" + sale.id, group: "Receipts", title: sale.invoice, description: `${sale.customerName} · ${shopTimestamp(sale.createdAt)} · ${currency(sale.total)}`, path: "/transactions/" + encodeURIComponent(sale.id) }));
  } });
  if (canOpen("/services")) tasks.push({ group: "Services", read: async () => {
    const services = await cached("services", () => repositories.services.list());
    return matching(services.filter(service => service.active), query, ["name", "code", "category"]).map(service => ({ id: "service:" + service.id, group: "Services", title: service.name, description: `${service.code} · ${currency(service.sellingPrice)}`, path: "/services/" + encodeURIComponent(service.id) + "/edit" }));
  } });
  if (canOpen("/locations")) tasks.push({ group: "Locations", read: async () => {
    const locations = (await cached("locations", () => repositories.locations.list())).filter(location => !location.archived);
    const rows = locations.map(location => ({ ...location, fullPath: locationPath(location, locations) }));
    return matching(rows, query, ["code", "fullPath"]).map(location => ({ id: "location:" + location.id, group: "Locations", title: location.name, description: `${location.code} · ${location.fullPath}`, path: "/locations/" + encodeURIComponent(location.id) }));
  } });
  const settled = await Promise.allSettled(tasks.map(task => task.read()));
  return {
    results: settled.flatMap(result => result.status === "fulfilled" ? result.value : []),
    unavailable: tasks.filter((_, index) => settled[index].status === "rejected").map(task => task.group),
  };
}
