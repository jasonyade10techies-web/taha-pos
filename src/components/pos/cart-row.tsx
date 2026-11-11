import { Minus, Plus, Trash2, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import type { CartItem } from "../../types/product";
import { useCartStore } from "../../stores/cart-store";
import { currency } from "../../lib/utils";
import { ProductThumbnail } from "../ui/product-thumbnail";
import { usePermission } from "../../hooks/use-permission";

export function CartRow({
  item,
  onEdit,
}: {
  item: CartItem;
  onEdit: () => void;
}) {
  const changeQuantity = useCartStore((s) => s.changeQuantity);
  const allowNegativeStock = useCartStore((s) => s.allowNegativeStock);
  const remove = useCartStore((s) => s.remove);
  const canDiscount = usePermission("pricing.discount_within_range");
  const canChargeService = usePermission("services.create_custom");
  return (
    <motion.div
      className="cart-row"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="cart-row-top">
        <ProductThumbnail product={item.product} small />
        <div className="cart-item-description">
          <h3>{item.product.name}</h3>
          <p>
            {item.product.customService?.material?'Includes '+item.product.customService.material.quantity+' '+(item.product.compatibleModel||'linked part'):[item.product.qualityGrade, item.product.color]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          className="cart-remove"
          aria-label={`Remove ${item.product.name}`}
          onClick={() => remove(item.product.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="cart-row-bottom">
        <div className="quantity-control">
          <button
            aria-label={`Decrease ${item.product.name} quantity`}
            disabled={item.quantity <= 1}
            onClick={() => changeQuantity(item.product.id, item.quantity - 1)}
          >
            <Minus size={13} />
          </button>
          <span aria-label={`${item.product.name} quantity`}>
            {item.quantity}
          </span>
          <button
            aria-label={`Increase ${item.product.name} quantity`}
            disabled={
              !allowNegativeStock &&
              item.product.category !== "Services" &&
              item.quantity >= item.product.quantity
            }
            onClick={() => changeQuantity(item.product.id, item.quantity + 1)}
          >
            <Plus size={13} />
          </button>
        </div>
        <button
          className="cart-edit-price"
          disabled={item.product.customService ? !canChargeService : !canDiscount}
          onClick={onEdit}
          aria-label={`Edit ${item.product.name} price`}
          title="Edit unit selling price"
        >
          <span>{currency(item.unitPrice)}</span>
          <Pencil size={12} />
        </button>
      </div>
      {item.unitPrice !== item.product.sellingPrice && (
        <span className="negotiated-note">
          Negotiated price · {item.priceReason}
        </span>
      )}
    </motion.div>
  );
}
