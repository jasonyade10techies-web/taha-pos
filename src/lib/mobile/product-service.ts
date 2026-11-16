import { apiRequest, ApiError } from "../api/client";
import { apiGallery } from "../api/gallery";
import { requireMobileOnline, staffStorePath } from "./staff-service";
import type { ProductRow } from "../../types/database";
export type MobileProductInput = Pick<
  ProductRow,
  | "id"
  | "name"
  | "category"
  | "brand"
  | "compatible_model"
  | "quality_grade"
  | "color_variant"
  | "selling_price"
  | "minimum_selling_price"
  | "aliases"
  | "notes"
  | "low_stock_level"
  | "variant"
  | "unit"
  | "default_location_id"
>;

/** Mobile writes use an explicit catalog projection; costs and stock mutations are separate. */
export const mobileProductService = {
  async create(
    input: MobileProductInput,
    mediaPaths: string[] = [],
  ): Promise<ProductRow> {
    requireMobileOnline();
    // Keep one client-generated ID for the whole draft. A lost acknowledgement
    // must not create a second product or silently overwrite an existing row.
    const body: MobileProductInput & {
      media_paths: string[];
      primary_image_url: string | null;
    } = {
      id: input.id,
      name: input.name.trim(),
      category: input.category.trim(),
      brand: input.brand.trim(),
      compatible_model: input.compatible_model.trim(),
      quality_grade: input.quality_grade.trim(),
      color_variant: input.color_variant.trim(),
      selling_price: input.selling_price,
      minimum_selling_price: input.minimum_selling_price,
      aliases: input.aliases.map((a) => a.trim()).filter(Boolean),
      notes: input.notes,
      low_stock_level: input.low_stock_level,
      variant: input.variant,
      unit: input.unit,
      default_location_id: input.default_location_id,
      media_paths: mediaPaths,
      primary_image_url: mediaPaths[0] ?? null,
    };
    if (
      !body.name ||
      !body.category ||
      !Number.isFinite(body.selling_price) ||
      body.selling_price < 0 ||
      !Number.isFinite(body.minimum_selling_price) ||
      body.minimum_selling_price < 0 ||
      body.minimum_selling_price > body.selling_price
    )
      throw new Error("Enter a product name and valid prices.");
    try {
      return await apiRequest<ProductRow>(`${staffStorePath()}/products`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.status === 0 || cause.status === 409 || cause.status >= 500)
      ) {
        try {
          const row = await mobileProductService.get(body.id);
          const fields = Object.keys(input) as (keyof MobileProductInput)[];
          // PostgreSQL numeric columns arrive as decimal strings on GET.
          // Confirm the same prices by value while keeping metadata strict.
          const matches = (key: keyof MobileProductInput) =>
            key === "selling_price" || key === "minimum_selling_price"
              ? Number.isFinite(Number(row?.[key])) &&
                Number(row[key]) === body[key]
              : JSON.stringify(row?.[key]) === JSON.stringify(body[key]);
          if (
            row &&
            fields.every(matches) &&
            row.primary_image_url === body.primary_image_url
          ) {
            const gallery = await apiGallery("product", body.id);
            if (
              JSON.stringify(gallery.map((image) => image.path)) ===
              JSON.stringify(mediaPaths)
            )
              return row;
          }
        } catch {
          /* Preserve the original save failure; a read failure is not success. */
        }
      }
      throw cause;
    }
  },
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
