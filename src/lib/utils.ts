import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const formatCurrency = (value: number) =>
  `PKR ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value)}`;
/** Backwards-compatible alias used by existing features. */
export const currency = formatCurrency;
export const number = (value: number) =>
  new Intl.NumberFormat("en-PK").format(value);
