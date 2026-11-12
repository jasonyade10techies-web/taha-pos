import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../stores/session-store";
import { supabase } from "../lib/supabase/client";
import { apiEnabled, localDemoEnabled } from "../lib/config";
import { subscribeCounter } from "../lib/api/realtime";
import { useUiStore } from "../stores/ui-store";
export function useInventoryRealtime() {
  const store = useSessionStore((s) => s.context?.store?.id);
  const subject = useSessionStore((s) => s.profile?.id);
  const terminal = useSessionStore((s) => s.terminal);
  const context = useSessionStore((s) => s.context);
  const cache = useQueryClient();
  useEffect(() => {
    if (localDemoEnabled || !store || !subject || context?.companion) return;
    if (apiEnabled) {
      const invalidate = () => void cache.invalidateQueries();
      const disconnect = subscribeCounter(store, useUiStore.getState().terminalId, invalidate, subject);
      window.addEventListener("taha-remote-changed", invalidate); window.addEventListener("online", invalidate);
      return () => { disconnect(); window.removeEventListener("taha-remote-changed", invalidate); window.removeEventListener("online", invalidate); };
    }
    if (!supabase) return;
    const invalidate = () => void cache.invalidateQueries();
    const client = supabase;
    // Postgres Changes evaluates the individual JWT/RLS. The memory-only terminal
    // capability cannot be forwarded by Realtime, so terminal screens poll safe RPCs.
    const channel = terminal
      ? null
      : client.channel(`inventory:${store}:${subject}`);
    for (const table of ["products", "locations", "stock_movements"])
      channel?.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `store_id=eq.${store}` },
        invalidate,
      );
    channel?.subscribe();
    const timer = setInterval(invalidate, 15_000); // Recovery when WebSocket delivery is unavailable.
    window.addEventListener("taha-remote-changed", invalidate);
    window.addEventListener("online", invalidate);
    return () => {
      clearInterval(timer);
      window.removeEventListener("taha-remote-changed", invalidate);
      window.removeEventListener("online", invalidate);
      if (channel) void client.removeChannel(channel);
    };
  }, [store, subject, terminal, context, cache]);
}
