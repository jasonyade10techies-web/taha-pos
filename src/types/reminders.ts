export interface ReminderObligation {
  id: string;
  kind: "credit" | "test";
  customerId: string;
  customerName: string;
  phone: string;
  whatsappNumber: string;
  reference: string;
  description: string;
  occurredAt: string;
  dueAt?: string;
  amount?: number;
  quantity?: number;
  saleId?: string;
  testId?: string;
  status?: string;
  reminderEnabled: boolean;
}
export interface ReminderInput {
  idempotencyKey: string;
  obligationId: string;
  kind: "credit" | "test";
  action: "prepared" | "whatsapp-opened" | "contacted";
  message?: string;
  expectedAmount?: number;
  expectedDueAt?: string | null;
  expectedQuantity?: number;
}
export interface ReminderHistory extends ReminderInput {
  id: string;
  customerId: string;
  employeeId: string;
  employeeName?: string;
  createdAt: string;
}
export interface ReminderAlert {
  id: string;
  customerId: string;
  kind: "credit" | "test";
  title: string;
  description: string;
  href: string;
  dueAt?: string;
}
