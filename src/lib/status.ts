export type BadgeTone =
  "success" | "warning" | "danger" | "info" | "credit" | "neutral" | "offline";
export const statusTones: Record<string, BadgeTone> = {
  "IN STOCK": "success",
  "LOW STOCK": "warning",
  "OUT OF STOCK": "danger",
  PAID: "success",
  PARTIAL: "warning",
  CREDIT: "credit",
  "OUT FOR TEST": "info",
  OVERDUE: "danger",
  OFFLINE: "offline",
  "PENDING SYNC": "warning",
};
