import { requireSupabase } from "./client";
import { activeStore, result, rpc } from "./repository-utils";
import type { DemoEmployee, Supplier } from "../../types/demo";
export const remoteEmployees = {
  async setPermissions(
    id: string,
    permissions: import("../../types/auth").PermissionKey[],
  ) {
    await rpc("set_employee_permissions", {
      p_store_id: activeStore(),
      p_profile_id: id,
      p_permissions: permissions,
    });
    window.dispatchEvent(new Event("taha-session-refresh"));
  },
  async list(): Promise<DemoEmployee[]> {
    const rows =
      (await result(
        requireSupabase().rpc("get_employees", { p_store_id: activeStore() }),
      )) ?? [];
    return rows.map((p) => ({
      ...p,
      shift: "Phase 3B pending",
      lastActivity: p.updated_at,
    }));
  },
  async get(id: string) {
    return (await this.list()).find((p) => p.id === id);
  },
  async save(value: DemoEmployee) {
    await rpc("save_employee", {
      p_store_id: activeStore(),
      p_input: {
        id: value.id,
        full_name: value.full_name,
        phone: value.phone,
        role: value.role,
        status: value.status,
        permissions: value.permissions,
      },
    });
    window.dispatchEvent(new Event("taha-session-refresh"));
    return value;
  },
  async updateOwnProfile(name: string, phone: string) {
    await rpc("update_my_profile", { p_full_name: name, p_phone: phone });
    window.dispatchEvent(new Event("taha-session-refresh"));
  },
};
export const remoteSuppliers = {
  async list(): Promise<Supplier[]> {
    return (
      (await result(
        requireSupabase()
          .from("suppliers")
          .select("id,name,phone,whatsapp,address,notes")
          .eq("store_id", activeStore())
          .order("name"),
      )) ?? []
    );
  },
  async get(id: string) {
    return (await this.list()).find((s) => s.id === id);
  },
  async save(value: Supplier) {
    return await rpc("save_supplier", {
      p_store_id: activeStore(),
      p_input: { ...value },
    });
  },
};
export const remoteAudit = {
  async list() {
    const rows = await result(
      requireSupabase()
        .from("audit_logs")
        .select("*")
        .eq("store_id", activeStore())
        .order("created_at", { ascending: false })
        .limit(1000),
    );
    return (rows ?? []).map((e) => ({
      id: e.id,
      employeeId: e.actor_profile_id ?? "",
      employeeName: "Internal team",
      action: e.action,
      module: e.entity_type,
      description: e.action.replaceAll(".", " · ").replaceAll("_", " "),
      reference: e.entity_id ?? "",
      createdAt: e.created_at,
    }));
  },
  async get(id: string) {
    return (await this.list()).find((e) => e.id === id);
  },
};
