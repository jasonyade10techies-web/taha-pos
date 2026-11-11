import { requireSupabase } from "../supabase/client";
export const auditService = {
  log: async (action: "client.session_started" | "client.session_ended") => {
    const { error } = await requireSupabase().rpc("log_client_event", {
      p_action: action,
      p_version: "0.2.0",
    });
    if (error) throw error;
  },
};
