import {quoteTax} from '../../lib/tax';
import {useRepository} from '../../hooks/use-repository';
import { useState } from "react";
import {
  ShoppingBag,
  TicketPercent,
  ArrowRight,
  X,
  Monitor,
} from "lucide-react";
import type { CartItem } from "../../types/product";
import { useCartStore } from "../../stores/cart-store";
import { useSessionStore } from "../../stores/session-store";
import { cartTotals } from "../../lib/cart";
import { currency } from "../../lib/utils";
import { CartRow } from "./cart-row";
import { PriceDialog } from "./price-dialog";
import { Button } from "../ui/button";
import { localDemoEnabled } from "../../lib/config";
import { CustomerCombobox } from "./customer-combobox";
import { CustomServiceDialog } from "./custom-service-dialog";
import { repositories } from "../../lib/repositories";
import { Link } from "react-router-dom";

export function CartPanel() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const discount = useCartStore((s) => s.couponDiscount);
  const customerId = useCartStore((s) => s.customerId);
  const setCheckoutOpen = useSessionStore((s) => s.setCheckoutOpen);
  const [editing, setEditing] = useState<CartItem | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const settings = useRepository("cart-tax-settings",()=>repositories.settings.get());
  const coupons=useRepository("tax-coupons",()=>repositories.coupons.list());
  const tax=quoteTax(items,discount,settings.data?.taxProfiles,settings.data?.defaultTaxProfileId,coupons.data?.find(c=>c.code===useCartStore.getState().couponCode));
  const totals={...cartTotals(items,discount),total:tax.total};
  return (
    <aside className="cart-panel" aria-label="Current sale cart">
      <div className="cart-heading">
        <div>
          <ShoppingBag size={19} />
          <h2>Current Sale</h2>
          <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
        </div>
        <span className="text-xs text-muted">
          {localDemoEnabled ? "#DEMO-001" : "New invoice"}
        </span>
      </div>
      <div className="cart-customer">
        <div className="cart-customer-selector"><CustomerCombobox showIcon={false} disabled={!!useCartStore.getState().sourceTestId} /></div>
        <CustomServiceDialog />
      </div>
      <div className="cart-items">
        {items.length ? (
          items.map((item) => (
            <CartRow
              key={item.product.id}
              item={item}
              onEdit={() => setEditing(item)}
            />
          ))
        ) : (
          <div className="empty-state cart-empty">
            <ShoppingBag size={32} />
            <h3>Your cart is empty</h3>
            <p>Add a product to start a sale.</p>
          </div>
        )}
      </div>
      <div className="cart-summary">
        <div className="summary-line">
          <span>Subtotal</span>
          <strong data-testid="cart-subtotal">
            {currency(totals.subtotal)}
          </strong>
        </div>
        <div className="summary-line">
          <span>
            Discount <small>(included in prices)</small>
          </span>
          <span>{currency(totals.negotiatedDiscount)}</span>
        </div>
        <div className="summary-line">
          <span>Coupon</span>
          {coupon ? (
            <button
              className="coupon-applied"
              onClick={() => {
                setCoupon(false);
                setCode("");
              }}
              aria-label="Remove coupon"
            >
              − {currency(totals.couponDiscount)}
              <X size={13} />
            </button>
          ) : (
            <button
              className="text-link"
              onClick={() => setCouponOpen(!couponOpen)}
            >
              <TicketPercent size={14} />
              Add coupon
            </button>
          )}
        </div>
        {couponOpen && !coupon && (
          <form
            className="coupon-form"
            onSubmit={(e) => {
              e.preventDefault();
              void repositories.coupons
                .validate(code, items, customerId)
                .then((result) => {
                  setCoupon(true, result.code, result.discount);
                  setCouponOpen(false);
                  setCouponError("");
                })
                .catch((error) => setCouponError(error.message));
            }}
          >
            <div className="flex gap-2">
              <input
                className="input"
                aria-label="Coupon code"
                placeholder="Code: TAHA10"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit" size="small">
                Apply
              </Button>
            </div>
            {couponError && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {couponError}
              </p>
            )}
          </form>
        )}
        {tax.amount>0&&<div className="summary-line"><span>{tax.name}{tax.mode==="Inclusive"?" (included)":""}</span><strong>{currency(tax.amount)}</strong></div>}
        <div className="cart-total">
          <div>
            <span>Total Amount</span>
            <small>All prices in PKR</small>
          </div>
          <strong data-testid="cart-total">{currency(totals.total)}</strong>
        </div>
        <Button
          variant="primary"
          className="checkout-button"
          aria-label="CHECKOUT"
          disabled={!items.length}
          onClick={() => setCheckoutOpen(true)}
        >
          <span>CHECKOUT</span>
          <kbd>F4</kbd>
          <ArrowRight size={20} />
        </Button>
        <div className="cart-hint">
          {localDemoEnabled
            ? "Click a price to negotiate · Stock is checked as you add"
            : "Stock and prices are verified by the server at checkout"}
        </div>
        <Link to="/customer-display" className="customer-display-link">
          <Monitor size={14} />
          Preview customer display
        </Link>
      </div>
      {editing && (
        <PriceDialog
          key={editing.product.id}
          item={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </aside>
  );
}
