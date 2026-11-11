import { apiRequest } from "../api/client";
import { requireMobileOnline, staffStorePath } from "./staff-service";
import type { ProductRow } from "../../types/database";

/** Mobile writes use an explicit catalog projection; costs and stock mutations are separate. */
export const mobileProductService = {
  get(id: string) {
    return apiRequest<ProductRow>(
      `${staffStorePath()}/products/${encodeURIComponent(id)}`,
    );
  },
  save(row: ProductRow, mediaPaths?: string[]) {
    requireMobileOnline();
    return apiRequest<ProductRow>(`${staffStorePath()}/products`, {
      method: "POST",
      body: JSON.stringify({
        id: row.id,
        name: row.name,
        description_html: row.description_html,
        category: row.category,
        brand: row.brand,
        compatible_model: row.compatible_model,
        quality_grade: row.quality_grade,
        color_variant: row.color_variant,
        variant: row.variant,
        unit: row.unit,
        selling_price: Number(row.selling_price),
        minimum_selling_price: Number(row.minimum_selling_price),
        low_stock_level: row.low_stock_level,
        aliases: row.aliases,
        notes: row.notes,
        supplier_id: row.supplier_id,
        visibility: row.visibility,
        tags: row.tags,
        primary_image_url: mediaPaths
          ? mediaPaths[0] || null
          : row.primary_image_url,
        ...(mediaPaths ? { media_paths: mediaPaths } : {}),
        default_location_id: row.default_location_id,
        state: row.state,
        expected_updated_at: row.updated_at,
      }),
    });
  },
};
