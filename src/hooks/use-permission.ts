import { useSessionStore } from "../stores/session-store";
import { permitted } from "../features/auth/services/permission-service";
import type { PermissionKey } from "../types/auth";
export function usePermission(key: PermissionKey) {
  return useSessionStore((s) => permitted(s.profile, s.permissions, key));
}
