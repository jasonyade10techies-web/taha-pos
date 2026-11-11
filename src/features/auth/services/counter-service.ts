import {apiEnabled} from "../../../lib/config";
import {apiRequest,setApiCounterToken} from "../../../lib/api/client";
import {write} from "../../../lib/api/catalog-repositories";
import type {CounterEmployee,PinVerification} from "../../../types/auth";
import { requireSupabase, setCounterToken } from "../../../lib/supabase/client";
export const counterService = {
  employees: async () => {
    if(apiEnabled) return apiRequest<CounterEmployee[]>("/auth/counter/employees");
    const { data, error } = await requireSupabase().rpc(
      "list_counter_employees",
    );
    if (error) throw error;
    return data;
  },
  verify: async (profileId: string, pin: string) => {
    if(apiEnabled) { const data=await apiRequest<PinVerification>("/auth/counter/verify",{method:"POST",body:JSON.stringify({profileId,pin})}); if(data.ok && data.token) setApiCounterToken(data.token); return data; }
    const { data, error } = await requireSupabase().rpc("verify_counter_pin", {
      p_profile_id: profileId,
      p_pin: pin,
    });
    if (error) throw error;
    if (data.ok && data.token) setCounterToken(data.token);
    return data;
  },
  lock: async () => {
    if(apiEnabled) { try { await apiRequest("/auth/counter/lock",{method:"POST"}); } finally { setApiCounterToken(null); } return; }
    try {
      const { error } = await requireSupabase().rpc("lock_counter_session");
      if (error) throw error;
    } finally {
      setCounterToken(null);
    }
  },
  setPin: async (profileId: string, storeId: string, pin: string) => {
    if(apiEnabled) { await write(`/employees/${profileId}/pin`,{pin},"PUT"); return; }
    const { error } = await requireSupabase().rpc("set_employee_pin", {
      p_profile_id: profileId,
      p_store_id: storeId,
      p_pin: pin,
    });
    if (error) throw error;
  },
};
