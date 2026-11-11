import type {
  ProductRow,
  PosProductRow,
  LocationRow,
  StockMovementRow,
} from "../../types/database";
import type { DemoProduct, Location, Movement } from "../../types/demo";
import type { PosProduct } from "../../types/product";
// Explicit mapping drops unknown response fields, including any financial payload.
export function productModel(p: ProductRow, image = ""): DemoProduct {
  return {
    description: p.description_html ?? "",
    supplierId: p.supplier_id ?? "",
    visibility: p.visibility ?? "store",
    tags: p.tags ?? [],
    id: p.id,
    internalCode: p.internal_code,
    name: p.name,
    category: p.category,
    brand: p.brand,
    compatibleModel: p.compatible_model,
    qualityGrade: p.quality_grade,
    color: p.color_variant,
    sellingPrice: Number(p.selling_price),
    minimumSellingPrice: Number(p.minimum_selling_price),
    aliases: p.aliases,
    lowStockLevel: p.low_stock_level,
    state: p.state,
    locationId: p.default_location_id ?? "",
    variant: p.variant,
    unit: p.unit,
    notes: p.notes,
    image,
    imagePath: p.primary_image_url ?? "",
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}
export function posModel(p: PosProductRow, image = ""): PosProduct {
  return {
    id: p.id,
    internalCode: p.internal_code,
    name: p.name,
    category: p.category,
    brand: p.brand,
    compatibleModel: p.compatible_model,
    qualityGrade: p.quality_grade,
    color: p.color_variant,
    quantity: Number(p.quantity),
    sellingPrice: Number(p.selling_price),
    minimumSellingPrice: Number(p.minimum_selling_price),
    aliases: p.aliases,
    lowStockLevel: p.low_stock_level,
    image,
    location: p.location
      ? {
          rack: (p.location.rack ?? "").replace(/^Rack\s+/i, ""),
          shelf: p.location.shelf.replace(/^Shelf\s+/i, ""),
          box: p.location.box.replace(/^Box\s+/i, ""),
        }
      : null,
  };
}
export function locationModel(l: LocationRow): Location {
  return {
    stockCondition:l.stock_condition??'Available',
    id: l.id,
    code: l.internal_code,
    name: l.name,
    kind: l.kind,
    parentId: l.parent_location_id ?? "",
    archived: !l.active,
    updatedAt: l.updated_at,
  };
}
export function movementModel(m: StockMovementRow): Movement {
  return {
    id: m.id,
    productId: m.product_id,
    locationId: m.location_id,
    quantity: m.quantity,
    type: m.movement_type,
    reference: m.reference_id ?? "",
    employeeId: m.actor_profile_id,
    notes: m.notes,
    createdAt: m.created_at,
  };
}
