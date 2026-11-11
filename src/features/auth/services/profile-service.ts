import { requireSupabase } from "../../../lib/supabase/client";
import { apiEnabled, localDemoEnabled } from "../../../lib/config";
import { apiAuth } from "../../../lib/api/client";
import { apiStoreMedia } from "../../../lib/api/media";
import { write } from "../../../lib/api/catalog-repositories";
import { demoDb, atomic, requireValue } from "../../../lib/local/database";
import { actor, audit } from "../../../lib/local/common";
export const profileService = {
  context: async () => {
    if (apiEnabled) return apiAuth.context();
    const { data, error } = await requireSupabase().rpc("get_session_context");
    if (error) throw error;
    return data;
  },
  updateOwnProfile: async (fullName: string, phone: string) => {
    if (apiEnabled) { await write("/profile", { fullName, phone }, "PATCH"); return; }
    const { error } = await requireSupabase().rpc("update_my_profile", {
      p_full_name: fullName,
      p_phone: phone,
    });
    if (error) throw error;
  },
  updateOwnAvatar: async (image: string, fullName: string, phone: string, storedPath?: string) => {
    if (localDemoEnabled) {
      await atomic(async () => { const employee = await demoDb.employees.get(actor().id); requireValue(employee?.status === "active", "An active employee is required."); await demoDb.employees.update(employee.id, { avatar_url: image || null }); await audit("profile.photo_updated", "Employees", "Own profile photo updated", employee.id); }); return;
    }
    if (apiEnabled) { const avatarPath = await apiStoreMedia(image, "profile", storedPath); await write("/profile", { fullName, phone, avatarPath }, "PATCH"); return; }
    throw new Error("Connect to your shop to save your profile photo.");
  },
};
