import { BadRequestException } from '@nestjs/common';

type Input = Record<string, unknown>;
export const REPAIR_STATUSES = ['Received', 'Diagnosing', 'Waiting Approval', 'Waiting Part', 'In Repair', 'Testing', 'Ready', 'Delivered', 'Cancelled'] as const;

function fail(message: string): never { throw new BadRequestException(message); }
function record(value: unknown): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Check the form values.');
  return value as Input;
}
function fields(value: Input, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('This form contains unsupported fields.');
}
export function workflowId(value: unknown, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail('Select a valid record.');
  return value;
}
function text(value: unknown, label: string, max: number, required = false): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') fail(`Check ${label.toLowerCase()}.`);
  const result = value.trim();
  if (result.length > max || (required && result.length === 0)) fail(`${label} must ${required ? 'contain text and ' : ''}be no more than ${max} characters.`);
  return result;
}
function money(value: unknown, label: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 999999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) fail(`${label} must be a non-negative PKR amount with no more than two decimal places.`);
  return value;
}
function boolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') fail('Check the enabled setting.');
  return value;
}
export function serviceInput(input: unknown) {
  const v = record(input);
  fields(v, ['id', 'code', 'name', 'category', 'sellingPrice', 'minimumSellingPrice', 'active', 'notes', 'linkedProductId', 'defaultLaborCharge', 'pricingRule', 'description', 'createdBy', 'updatedBy', 'requiresReview']);
  const price = money(v.sellingPrice, 'Selling price');
  const minimum = money(v.minimumSellingPrice, 'Minimum selling price');
  if (minimum > price) fail('Minimum selling price cannot exceed the listed price.');
  const linkedProductId = workflowId(v.linkedProductId, true);
  if (v.pricingRule !== undefined && v.pricingRule !== 'current-product-plus-labor') fail('Use current product price plus default labor.');
  if (!linkedProductId && (v.defaultLaborCharge !== undefined || v.pricingRule !== undefined)) fail('Select a linked product for this pricing rule.');
  return { id: workflowId(v.id, true), name: text(v.name, 'Service name', 200, true), category: text(v.category, 'Category', 120, true), sellingPrice: price, minimumSellingPrice: minimum, active: boolean(v.active, true), notes: text(v.notes, 'Notes', 4000), ...(linkedProductId ? {linkedProductId, defaultLaborCharge:money(v.defaultLaborCharge,'Default labor charge',0),pricingRule:'current-product-plus-labor'} : {}), ...(v.description === undefined ? {} : {description:text(v.description,'Description',4000)}) };
}
export function repairInput(input: unknown) {
  const v = record(input);
  fields(v, ['id', 'code', 'customerId', 'customerName', 'phone', 'device', 'imei', 'problem', 'damage', 'photos', 'photoCategories', 'estimate', 'advance', 'technicianId', 'notes', 'status', 'createdAt']);
  const status = v.status ?? 'Received';
  if (typeof status !== 'string' || !REPAIR_STATUSES.includes(status as typeof REPAIR_STATUSES[number])) fail('Select a valid repair status.');
  if (money(v.advance, 'Advance', 0) !== 0) fail('Record repair payments through the sale or customer payment workflow. An unverified advance cannot be entered here.');
  const photos = v.photos ?? [];
  if (!Array.isArray(photos) || photos.length > 12 || photos.some(p => typeof p !== 'string' || p.length > 240 || !/^[0-9a-f-]{36}\/repair\/[0-9a-f-]{36}\.webp$/i.test(p))) fail('Select uploaded repair photos. External links and local image data are not allowed.');
  if (new Set(photos).size !== photos.length) fail('The same repair photo was selected twice.');
  let photoCategories: string[] | undefined;
  if (v.photoCategories !== undefined) {
    if (!Array.isArray(v.photoCategories) || v.photoCategories.length !== photos.length || v.photoCategories.some(category => typeof category !== 'string' || !['Before', 'After', 'Damage', 'Customer-provided'].includes(category))) fail('Choose Before, After, Damage or Customer-provided for each repair photo.');
    photoCategories = v.photoCategories as string[];
  }
  return { id: workflowId(v.id, true), customerId: workflowId(v.customerId, true), customerName: text(v.customerName, 'Customer name', 200), phone: text(v.phone, 'Phone', 40), device: text(v.device, 'Device', 200, true), imei: text(v.imei, 'IMEI / serial', 100), problem: text(v.problem, 'Problem description', 4000, true), damage: text(v.damage, 'Visible damage', 4000), photos: photos as string[], ...(photoCategories === undefined ? {} : { photoCategories }), estimate: money(v.estimate, 'Estimate', 0), advance: 0, technicianId: workflowId(v.technicianId, true), notes: text(v.notes, 'Notes', 4000), status };
}
export function shiftInput(input: unknown) {
  const v = record(input);
  fields(v, ['id', 'employeeId', 'date', 'start', 'end', 'status', 'openingCash', 'countedCash', 'cashExpenses', 'expectedCash', 'difference', 'notes', 'closedAt']);
  const date = text(v.date, 'Shift date', 10, true), start = text(v.start, 'Start time', 5, true), end = text(v.end, 'End time', 5, true);
  const parsed = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) fail('Enter a valid shift date.');
  if (![start, end].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || end <= start) fail('Shift end time must be after its start time.');
  if (v.status !== 'Scheduled' && v.status !== 'Open') fail('Close an open shift using the cash reconciliation action.');
  if (v.expectedCash != null || v.countedCash != null || v.difference != null || v.closedAt != null || (v.cashExpenses !== undefined && v.cashExpenses !== 0)) fail('Cash closing values are calculated by the server.');
  return { id: workflowId(v.id, true), employeeId: workflowId(v.employeeId), date, start, end, status: v.status, openingCash: money(v.openingCash, 'Opening cash', 0), notes: text(v.notes, 'Notes', 4000) };
}
export function closingInput(input: unknown) {
  const v = record(input);
  fields(v, ['counted', 'expenses', 'notes']);
  return { counted: money(v.counted, 'Counted cash'), expenses: money(v.expenses, 'Cash expenses', 0), notes: text(v.notes, 'Closing notes', 4000) };
}
