import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";
import {
  supabaseConfigured,
  supabasePublicKey,
  supabaseUrl,
  configurationMessage,
  mockAuthEnabled,
} from "../config";

let counterToken: string | null = null;
export const setCounterToken = (token: string | null) => {
  counterToken = token;
};
// The PIN-derived capability is memory-only and is attached to the authenticated terminal JWT.
const authorizedFetch: typeof fetch = (input, init) => {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  if (counterToken) headers.set("x-counter-session", counterToken);
  return fetch(input, { ...init, headers });
};
export const supabase =
  supabaseConfigured && !mockAuthEnabled
    ? createClient<Database>(supabaseUrl, supabasePublicKey, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "taha-pos-auth",
        },
        global: { fetch: authorizedFetch },
      })
    : null;
export function requireSupabase() {
  if (!supabase) throw new Error(configurationMessage);
  return supabase;
}
