import type { CustomerDisplayItem } from "./product";

export type CustomerDisplayMode =
  | "IDLE"
  | "CART_ACTIVE"
  | "CHECKOUT"
  | "PAYMENT"
  | "SALE_COMPLETE";

export type DisplayPayment = {
  method: string;
  kind?: "Cash" | "Digital" | "Credit" | "Split";
  total: number;
  cashReceived?: number;
  change?: number;
  paidNow?: number;
  outstanding?: number;
  title?: string;
  number?: string;
  iban?: string;
  qr?: string;
};

export type CustomerDisplayState = {
  tax?: {name:string;rate:number;mode:"Exclusive"|"Inclusive";amount:number};
  receiptUrl?: string;
  mode: CustomerDisplayMode;
  terminalId: string;
  displaySessionId?: string;
  items: CustomerDisplayItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment?: DisplayPayment;
  couponDiscount?: number;
  negotiatedDiscount?: number;
  couponCode?: string;
  cancelled?: boolean;
  config?: {
    phone?: string;
    address?: string;
    promotions: boolean;
    paymentQr: boolean;
    enabled: boolean;
    fullscreen: boolean;
    completeDuration: number;
    methods: Array<{ name: string; kind: string }>;
  };
  invoiceNumber?: string;
  saleId?: string;
  completedAt?: string;
};

export type CameraJobType =
  | "connection-test"
  | "payment-proof"
  | "product-photo"
  | "used-device-photo"
  | "repair-intake"
  | "customer-photo"
  | "profile-picture"
  | "damage-evidence"
  | "receipt-document";

export type CameraJobStatus =
  | "waiting"
  | "opened"
  | "captured"
  | "uploading"
  | "received"
  | "expired"
  | "cancelled"
  | "failed";

export type CameraJob = {
  id: string;
  type: CameraJobType;
  title: string;
  reference?: string;
  amount?: number;
  terminalId: string;
  status: CameraJobStatus;
  assignmentState?: "UNASSIGNED" | "ASSIGNED" | "CLAIMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  imageDataUrl?: string;
  imagePath?: string;
  error?: string;
  createdAt: string;
  expiresAt?: string;
  entityId?: string;
  ownerInstanceId?: string;
  mediaId?: string;
  deviceId?: string;
  deviceName?:string;
  timings?:{receivedAt:string;processingMs:number;thumbnailMs:number;storageMs:number};
  maxCaptures?:number;
  targetSlot?:string;
  qrPayload?:string;
  diagnostic?:boolean;
  captures?:Array<{captureId:string;mediaId:string;imagePath:string;imageUrl:string;thumbnailUrl?:string;createdAt:string;size?:number}>;
};
