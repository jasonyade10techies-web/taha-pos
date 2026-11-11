export const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
export const text = (value: unknown) => String(value ?? "");
export const num = (value: unknown) => Number(value) || 0;
export {shopDay as today,shopTimestamp as stamp} from '../../lib/shop-time';
