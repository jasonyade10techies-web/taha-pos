import { repositories } from "../repositories";
import { useSessionStore } from "../../stores/session-store";
import type { Approval } from "../../types/demo";
import type { PermissionKey } from "../../types/auth";
import { demoPinEnabled } from "../config";
/** DEMO APPROVAL SERVICE. Public demo PIN 123456 is not authentication or production authorization. */
export const demoApprovalService = {
  async approve(
    managerId: string,
    pin: string,
    original: number,
    price: number,
    reason: string,
  ): Promise<Approval> {
    if (!demoPinEnabled)
      throw new Error(
        "Demo approvals are available only in development Local Demo mode.",
      );
    const manager = await repositories.employees.get(managerId);
    if (
      pin !== "123456" ||
      manager?.status !== "active" ||
      !(
        manager.role === "owner" ||
        manager.permissions.includes("pricing.override_minimum")
      )
    )
      throw new Error("Use demo PIN 123456 with an eligible manager.");
    return {
      managerId,
      managerName: manager.full_name,
      original,
      price,
      reason,
      employeeId: useSessionStore.getState().employee.id,
      createdAt: new Date().toISOString(),
    };
  },
  async verifyAction(
    managerId: string,
    pin: string,
    permission: PermissionKey,
  ) {
    if (!demoPinEnabled)
      throw new Error(
        "Demo approvals are available only in development Local Demo mode.",
      );
    const manager = await repositories.employees.get(managerId);
    if (
      pin !== "123456" ||
      manager?.status !== "active" ||
      !(manager.role === "owner" || manager.permissions.includes(permission))
    )
      throw new Error(
        "Use demo PIN 123456 with an eligible approving manager.",
      );
    return manager.id;
  },
};
