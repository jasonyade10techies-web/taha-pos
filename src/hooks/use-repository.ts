import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../stores/session-store";
import { toast } from "../stores/toast-store";
import { dataProvider } from "../lib/config";
export function useRepository<T>(
  key: string,
  load: () => Promise<T>,
  enabled = true,
) {
  const employee = useSessionStore((s) => s.employee.id);
  const branch = useSessionStore((s) => s.context?.store?.id);
  return useQuery({
    queryKey: [dataProvider, employee, branch, key],
    queryFn: load,
    staleTime: 30_000,
    enabled,
  });
}
export function useAction() {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return {
    busy,
    error,
    async run<T>(
      fn: () => Promise<T>,
      message: string,
      after?: (value: T) => void,
    ) {
      if (busy) return;
      setBusy(true);
      setError("");
      try {
        const result = await fn();
        // Finish refreshing the current editor before navigating back to it.
        await cache.invalidateQueries();
        toast(message);
        after?.(result);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to complete this action. Try again.";
        setError(message);
        toast(message, "error");
      } finally {
        setBusy(false);
      }
    },
  };
}
