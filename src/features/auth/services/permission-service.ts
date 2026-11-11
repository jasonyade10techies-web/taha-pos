import { requireSupabase } from "../../../lib/supabase/client";
import type { PermissionKey } from "../../../types/auth";
export { permitted } from "../../../lib/permissions";
export const permissionService = {
  set: async (
    profileId: string,
    storeId: string,
    key: PermissionKey,
    enabled: boolean,
  ) => {
    const { error } = await requireSupabase().rpc("set_employee_permission", {
      p_profile_id: profileId,
      p_store_id: storeId,
      p_key: key,
      p_enabled: enabled,
    });
    if (error) throw error;
  },
};
