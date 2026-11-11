import { requireSupabase } from "../supabase/client";
import type { PosProduct } from "../../types/product";
export const productRepository = {
  listForPos: async (storeId: string): Promise<PosProduct[]> => {
    const { data, error } = await requireSupabase().rpc("get_pos_products", {
      p_store_id: storeId,
    });
    if (error) throw error;
    return data.map((p) => ({
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
      location: p.location
        ? {
            rack: (p.location.rack ?? "").replace(/^Rack\s+/i, ""),
            shelf: p.location.shelf.replace(/^Shelf\s+/i, ""),
            box: p.location.box.replace(/^Box\s+/i, ""),
          }
        : null,
    }));
  },
};
