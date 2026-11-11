import type { PermissionKey, Profile } from "../types/auth";
/** Pure client affordance check. Every server mutation still authorizes independently. */
export function permitted(profile: Profile | null, permissions: readonly PermissionKey[], key: PermissionKey) {
  return profile?.status === "active" && (profile.role === "owner" || permissions.includes(key));
}
