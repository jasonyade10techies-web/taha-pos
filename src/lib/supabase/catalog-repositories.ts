import type {
  ProductRepository,
  LocationRepository,
  InventoryRepository,
} from "../repositories/interfaces";
import type { ProductInput, Location, ReceiveDraft } from "../../types/demo";
import { requireSupabase } from "./client";
import { activeStore, allowed, result, rpc, allRows } from "./repository-utils";
import {
  productModel,
  posModel,
  locationModel,
  movementModel,
} from "./mappers";
import {
  signedImages,
  uploadProductImage,
  removeProductImage,
} from "./product-images";

export class SupabaseProductRepository implements ProductRepository {
  async saveValue(_kind: string, _value: string): Promise<{id:string;kind:string;value:string}> {
    void _kind; void _value;
    throw new Error("Catalogue value creation requires the custom shop backend.");
  }
  async values() {
    return (
      (await allRows((from, to) =>
        requireSupabase()
          .from("catalog_values")
          .select("kind,value")
          .eq("store_id", activeStore())
          .order("kind")
          .order("value")
          .range(from, to),
      )) ?? []
    );
  }
  async list() {
    const rows =
      (await allRows((from, to) =>
        requireSupabase()
          .from("products")
          .select("*")
          .eq("store_id", activeStore())
          .order("internal_code")
          .range(from, to),
      )) ?? [];
    const images = await signedImages(rows.map((p) => p.primary_image_url));
    return rows.map((p) =>
      productModel(p, images.get(p.primary_image_url ?? "")),
    );
  }
  async get(id: string) {
    const p = await result(
      requireSupabase()
        .from("products")
        .select("*")
        .eq("store_id", activeStore())
        .eq("id", id)
        .maybeSingle(),
    );
    if (!p) return undefined;
    return productModel(
      p,
      (await signedImages([p.primary_image_url])).get(
        p.primary_image_url ?? "",
      ),
    );
  }
  async pos() {
    const rows =
      (await result(
        requireSupabase().rpc("get_pos_products", {
          p_store_id: activeStore(),
        }),
      )) ?? [];
    const images = await signedImages(rows.map((p) => p.primary_image_url));
    return rows.map((p) => posModel(p, images.get(p.primary_image_url ?? "")));
  }
  async cost(id: string) {
    if (!allowed("costs.view_purchase_cost")) return null;
    const row = await result(
      requireSupabase()
        .from("product_financials")
        .select("purchase_cost")
        .eq("store_id", activeStore())
        .eq("product_id", id)
        .maybeSingle(),
    );
    return row ? Number(row.purchase_cost) : null;
  }
  async save(input: ProductInput) {
    const store = activeStore();
    const id = input.id ?? crypto.randomUUID();
    let path = input.image ? (input.imagePath ?? "") : "";
    let uploaded = "";
    if (input.image.startsWith("data:"))
      path = uploaded = await uploadProductImage(store, id, input.image);
    try {
      const saved = await rpc("save_product", {
        p_store_id: store,
        p_input: {
          id,
          name: input.name,
          category: input.category,
          brand: input.brand,
          compatible_model: input.compatibleModel,
          quality_grade: input.qualityGrade,
          color_variant: input.color,
          variant: input.variant,
          unit: input.unit,
          selling_price: input.sellingPrice,
          minimum_selling_price: input.minimumSellingPrice,
          aliases: input.aliases,
          notes: input.notes,
          low_stock_level: input.lowStockLevel,
          primary_image_url: path || null,
          default_location_id: input.locationId || null,
          initial_quantity: input.initialQuantity,
          expected_updated_at: input.updatedAt ?? null,
          ...(input.purchaseCost === undefined
            ? {}
            : { purchase_cost: input.purchaseCost }),
        },
      });
      // Storage and SQL cannot share a transaction. Unreferenced objects are safe to retry
      // cleaning later; never undo a committed product because best-effort cleanup failed.
      if (input.imagePath && input.imagePath !== path)
        await removeProductImage(input.imagePath).catch(() => undefined);
      return productModel(saved, input.image);
    } catch (error) {
      // If the RPC committed but its response was lost, policy denies deleting a referenced image.
      if (uploaded) await removeProductImage(uploaded).catch(() => undefined);
      throw error;
    }
  }
  async duplicate(id: string) {
    return productModel(
      await rpc("duplicate_product", { p_store_id: activeStore(), p_id: id }),
    );
  }
  async archive(id: string) {
    await rpc("archive_product", { p_store_id: activeStore(), p_id: id });
  }
}
export class SupabaseLocationRepository implements LocationRepository {
  async list() {
    return (
      (await allRows((from, to) =>
        requireSupabase()
          .from("locations")
          .select("*")
          .eq("store_id", activeStore())
          .order("internal_code")
          .range(from, to),
      )) ?? []
    ).map(locationModel);
  }
  async get(id: string) {
    return (await this.list()).find((l) => l.id === id);
  }
  async path(id: string) {
    const locations = await this.list();
    const parts: string[] = [];
    const visited = new Set<string>();
    let location = locations.find((l) => l.id === id);
    while (location && !visited.has(location.id)) {
      visited.add(location.id);
      parts.unshift(location.name);
      location = locations.find((l) => l.id === location!.parentId);
    }
    return parts.join(" → ");
  }
  async save(value: Location) {
    return locationModel(
      await rpc("save_location", {
        p_store_id: activeStore(),
        p_input: {
          id: value.id,
          name: value.name,
          kind: value.kind,
          parent_id: value.parentId || null,
          expected_updated_at: value.updatedAt ?? null,
        },
      }),
    );
  }
  async archive(id: string) {
    await rpc("archive_location", { p_store_id: activeStore(), p_id: id });
  }
  balances = () => new SupabaseInventoryRepository().balances();
}
export class SupabaseInventoryRepository implements InventoryRepository {
  async balances() {
    return (
      (await allRows((from, to) =>
        requireSupabase()
          .from("stock_balances")
          .select("*")
          .eq("store_id", activeStore())
          .order("product_id")
          .order("location_id")
          .range(from, to),
      )) ?? []
    ).map((b) => ({
      id: `${b.product_id}:${b.location_id}`,
      productId: b.product_id,
      locationId: b.location_id,
      quantity: Number(b.quantity),
    }));
  }
  async movements() {
    return (
      (await result(
        requireSupabase()
          .from("stock_movements")
          .select("*")
          .eq("store_id", activeStore())
          .order("created_at", { ascending: false })
          .limit(1000),
      )) ?? []
    ).map(movementModel);
  }
  async drafts() {
    const store = activeStore();
    const [receipts, lines, costs] = await Promise.all([
      allRows((from, to) =>
        requireSupabase()
          .from("stock_receipts")
          .select("*")
          .eq("store_id", store)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      allRows((from, to) =>
        requireSupabase()
          .from("stock_receipt_lines")
          .select("*")
          .eq("store_id", store)
          .order("receipt_id")
          .order("line_no")
          .range(from, to),
      ),
      allowed("costs.view_purchase_cost")
        ? allRows((from, to) =>
            requireSupabase()
              .from("stock_receipt_costs")
              .select("*")
              .eq("store_id", store)
              .order("receipt_id")
              .order("line_no")
              .range(from, to),
          )
        : Promise.resolve([]),
    ]);
    return (receipts ?? []).map((r) => ({
      id: r.id,
      supplierId: r.supplier_id,
      reference: r.reference,
      date: r.received_date,
      status: r.status,
      createdAt: r.created_at,
      lines: (lines ?? [])
        .filter((l) => l.receipt_id === r.id)
        .sort((a, b) => a.line_no - b.line_no)
        .map((l) => ({
          productId: l.product_id,
          locationId: l.location_id,
          quantity: l.quantity,
          cost: Number(
            costs?.find((c) => c.receipt_id === r.id && c.line_no === l.line_no)
              ?.purchase_cost ?? 0,
          ),
        })),
    }));
  }
  private async save(draft: ReceiveDraft, receive: boolean) {
    await rpc("save_stock_receipt", {
      p_store_id: activeStore(),
      p_receive: receive,
      p_input: {
        id: draft.id,
        supplier_id: draft.supplierId,
        reference: draft.reference,
        date: draft.date,
        lines: draft.lines.map((l) => ({
          product_id: l.productId,
          location_id: l.locationId,
          quantity: l.quantity,
          ...(allowed("costs.view_purchase_cost")
            ? { purchase_cost: l.cost }
            : {}),
        })),
      },
    });
  }
  receive = (draft: ReceiveDraft) => this.save(draft, true);
  saveDraft = (draft: ReceiveDraft) => this.save(draft, false);
  async transfer(
    productId: string,
    source: string,
    destination: string,
    quantity: number,
  ) {
    await rpc("transfer_stock", {
      p_store_id: activeStore(),
      p_product_id: productId,
      p_source: source,
      p_destination: destination,
      p_quantity: quantity,
      p_request_id: crypto.randomUUID(),
    });
  }
  async adjust(
    productId: string,
    locationId: string,
    expected: number,
    quantity: number,
    reason: string,
  ) {
    await rpc("adjust_stock", {
      p_store_id: activeStore(),
      p_product_id: productId,
      p_location_id: locationId,
      p_expected: expected,
      p_new_quantity: quantity,
      p_reason: reason,
      p_request_id: crypto.randomUUID(),
    });
  }
}
