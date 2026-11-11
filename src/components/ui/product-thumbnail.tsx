import {MediaImage} from '../media/media-image';
import type { PosProduct } from "../../types/product";
import { cn } from "../../lib/utils";
import { useState } from "react";

/** Local schematic placeholders, isolated for future product photographs. */
export function ProductThumbnail({
  product,
  small = false,
}: {
  product: Pick<PosProduct, "name" | "category" | "image">;
  small?: boolean;
}) {
  const [unavailableImage, setUnavailableImage] = useState<string>();
  if (product.image && product.image !== unavailableImage)
    return (
      <div className={cn("product-thumbnail", small && "thumbnail-small")}>
        <MediaImage src={product.image} alt={product.name} onError={() => setUnavailableImage(product.image)} />
      </div>
    );
  const name = product.name.toLowerCase();
  const kind = name.includes("battery")
    ? "battery"
    : name.includes("board") || name.includes("port")
      ? "board"
      : name.includes("adapter")
        ? "adapter"
        : name.includes("cable")
          ? "cable"
          : product.category === "Services"
            ? "service"
            : "phone";
  return (
    <div
      className={cn(
        "product-thumbnail",
        `thumbnail-${kind}`,
        small && "thumbnail-small",
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" fill="none">
        {kind === "battery" && (
          <>
            <rect x="26" y="15" width="29" height="51" rx="4" fill="#29303A" />
            <rect x="34" y="11" width="12" height="5" rx="1" fill="#8893A0" />
            <path d="m43 27-10 16h9l-4 12 12-18h-9l2-10Z" fill="#D5DADF" />
            <path d="M32 60h16" stroke="#707D8B" strokeWidth="2" />
          </>
        )}
        {kind === "board" && (
          <>
            <path d="M17 27h44v8h7v22H12V35h5z" fill="#2F6660" />
            <rect x="28" y="38" width="20" height="16" rx="2" fill="#233F3C" />
            <rect x="28" y="19" width="22" height="15" rx="2" fill="#B5C0C2" />
            <rect x="31" y="23" width="16" height="6" rx="1" fill="#3A4147" />
            <path
              d="M19 41h5m-5 6h5m28-6h8m-8 6h8"
              stroke="#D6B866"
              strokeWidth="3"
            />
            <circle cx="18" cy="53" r="2" fill="#D6B866" />
            <circle cx="62" cy="53" r="2" fill="#D6B866" />
          </>
        )}
        {kind === "adapter" && (
          <>
            <path d="M32 15v13m16-13v13" stroke="#9AA3AE" strokeWidth="5" />
            <rect
              x="23"
              y="26"
              width="34"
              height="37"
              rx="8"
              fill="#FDFDFE"
              stroke="#CBD1D8"
              strokeWidth="2"
            />
            <rect x="34" y="50" width="12" height="5" rx="2" fill="#4D5661" />
            <path d="M29 34h22" stroke="#E7E9ED" />
          </>
        )}
        {kind === "phone" && (
          <>
            <rect x="23" y="11" width="35" height="59" rx="7" fill="#35414F" />
            <rect
              x="26"
              y="15"
              width="29"
              height="51"
              rx="4"
              fill={name.includes("case") ? "#566377" : "#D5DEE7"}
            />
            <path d="M32 16h17v4H32z" fill="#35414F" />
            <path d="m27 54 28-23v24L42 66H27z" fill="#B8C7D7" opacity=".7" />
            <circle cx="40" cy="61" r="2" fill="#8294A7" />
          </>
        )}
        {kind === "cable" && (
          <>
            <path
              d="M30 22v25a13 13 0 0 0 26 0V33"
              stroke="#ADB9C4"
              strokeWidth="5"
            />
            <rect
              x="24"
              y="13"
              width="12"
              height="16"
              rx="3"
              fill="#EEF0F3"
              stroke="#ADB9C4"
            />
            <rect
              x="50"
              y="19"
              width="12"
              height="16"
              rx="3"
              fill="#EEF0F3"
              stroke="#ADB9C4"
            />
          </>
        )}
        {kind === "service" && (
          <>
            <path
              d="m24 59 28-28m-8-11a16 16 0 0 0 19 19l-9-9 6-6 9 9a16 16 0 0 0-19-19l7 7-6 6-7-7Z"
              stroke="#8E7A50"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <circle cx="23" cy="60" r="5" fill="#8E7A50" />
          </>
        )}
      </svg>
    </div>
  );
}
