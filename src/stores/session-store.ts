import { create } from "zustand";
import type { Employee } from "../types/session";
import type {
  AuthStatus,
  PermissionKey,
  Profile,
  SessionContext,
} from "../types/auth";
import { mockAuthEnabled } from "../lib/config";

export const mockOwner: Profile = {
  id: "owner-1",
  full_name: "Ahmed Khan",
  email: "ahmed@example.invalid",
  phone: null,
  avatar_url: null,
  role: "owner",
  status: "active",
};
export const mockContext: SessionContext = {
  profile: mockOwner,
  permissions: [],
  store: {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Taha Mobiles",
    branch_name: "Main Branch",
  },
  terminal: false,
  counter_expires_at: null,
};
const signedOut: Employee = {
  id: "",
  name: "Signed out",
  role: "Signed out",
  initials: "TM",
};
function employeeFor(profile: Profile | null): Employee {
  return profile
    ? {
        id: profile.id,
        name: profile.full_name,
        role:
          profile.role === "owner"
            ? "Owner / Admin"
            : profile.role === "manager"
              ? "Manager"
              : "Employee",
        initials: profile.full_name
          .split(" ")
          .slice(0, 2)
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
      }
    : signedOut;
}
interface SessionState {
  employee: Employee;
  profile: Profile | null;
  permissions: PermissionKey[];
  context: SessionContext | null;
  authStatus: AuthStatus;
  authError: string | null;
  terminal: boolean;
  simulatedOffline: boolean;
  commandOpen: boolean;
  checkoutOpen: boolean;
  applyContext: (context: SessionContext) => void;
  resetAuth: (status?: AuthStatus, error?: string | null) => void;
  setSimulatedOffline: (value: boolean) => void;
  setCommandOpen: (value: boolean) => void;
  setCheckoutOpen: (value: boolean) => void;
}
// Identity, permissions, PIN tokens, and business state stay in memory. Only the Auth SDK persists its session.
export const useSessionStore = create<SessionState>((set) => ({
  employee: mockAuthEnabled ? employeeFor(mockOwner) : signedOut,
  profile: null,
  permissions: [],
  context: null,
  authStatus: "loading",
  authError: null,
  terminal: false,
  simulatedOffline: false,
  commandOpen: false,
  checkoutOpen: false,
  applyContext: (context) =>
    set({
      context,
      profile: context.profile,
      permissions: context.permissions,
      terminal: context.terminal,
      employee: employeeFor(context.profile),
      authError: null,
      authStatus:
        context.profile?.status === "active" && context.store
          ? "authenticated"
          : context.terminal
            ? "counter-locked"
            : "denied",
    }),
  resetAuth: (authStatus = "anonymous", authError = null) =>
    set({
      authStatus,
      authError,
      profile: null,
      permissions: [],
      context: null,
      terminal: false,
      employee: signedOut,
      commandOpen: false,
      checkoutOpen: false,
    }),
  setSimulatedOffline: (simulatedOffline) => set({ simulatedOffline }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
}));
