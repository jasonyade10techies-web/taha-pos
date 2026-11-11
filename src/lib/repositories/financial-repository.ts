import { requireSupabase } from "../supabase/client";
// Separate requests and server gates; never imported into POS components.
export const financialRepository = {
  purchaseCosts: async (storeId: string) => {
    const { data, error } = await requireSupabase().rpc(
      "get_product_financials",
      { p_store_id: storeId },
    );
    if (error) throw error;
    return data;
  },
  profit: async (storeId: string) => {
    const { data, error } = await requireSupabase().rpc("get_profit_summary", {
      p_store_id: storeId,
    });
    if (error) throw error;
    return data;
  },
};
