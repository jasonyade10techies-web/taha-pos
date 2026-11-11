import {MediaImage} from '../media/media-image';
import { QrCode } from "lucide-react";
export function PaymentQr({ image, name }: { image?: string; name: string }) {
  return image ? (
    <MediaImage className="payment-qr" src={image} alt={name + " QR"} />
  ) : (
    <div
      className="payment-qr-placeholder"
      aria-label={name + " QR not configured"}
    >
      <QrCode size={32} />
      <span>QR not configured</span>
    </div>
  );
}
