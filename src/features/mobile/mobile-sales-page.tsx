import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  ScanLine,
  Pencil,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { AppCheckbox } from "../../components/ui/app-checkbox";
import { MediaImage } from "../../components/media/media-image";
import { CustomerCombobox } from "../../components/pos/customer-combobox";
import { DateTimeInput } from "../../components/ui/date-time-input";
import { apiRepositories as r } from "../../lib/api/repositories";
import { staffService } from "../../lib/mobile/staff-service";
import {
  completeMobileSale,
  emptyMobileDraft,
  loadMobileDraft,
  mobileDraftScope,
  saveMobileDraft,
  shareMobileReceipt,
  openMobileWhatsapp,
  type MobileDraft,
} from "../../lib/mobile/sales-service";
import { posModel } from "../../lib/supabase/mappers";
import { searchProducts } from "../../lib/product-search";
import { quoteTax } from "../../lib/tax";
import { currency } from "../../lib/utils";

import { ApiError } from "../../lib/api/client";
import { useShopConfiguration } from "../../hooks/use-shop-configuration";
import { MobileServiceDialog } from "./mobile-service-dialog";
import {MobileServicePrice} from './mobile-service-price';
import { toast } from "../../stores/toast-store";
import type { PosProduct } from "../../types/product";
import type { Sale, SaleInput } from "../../types/demo";
import { useSessionStore } from "../../stores/session-store";
import { useShopConnectionStore } from "../../stores/shop-connection-store";
import "./mobile-sales.css";

export function MobileSalesPage() {
  useSessionStore((s) => s.profile?.id);
  useSessionStore((s) => s.context?.store?.id);
  useShopConnectionStore((s) => s.baseUrl);
  const scope = mobileDraftScope();
  return <MobileSalesWorkspace key={scope} scope={scope} />;
}
function MobileSalesWorkspace({ scope }: { scope: string }) {
  const [draft, setDraft] = useState<MobileDraft>(() => loadMobileDraft(scope)),
    [step, setStep] = useState<"search" | "cart" | "payment">(() =>
      loadMobileDraft(scope).submitted ? "payment" : "search",
    );
  const [params] = useSearchParams(),
    [search, setSearch] = useState(params.get("code") || ""),
    [service, setService] = useState(false),
    [createProduct, setCreateProduct] = useState(false);
  const [sale, setSale] = useState<Sale | null>(null),
    [receipt, setReceipt] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [editing,setEditing]=useState('');
  const [serviceTemplate,setServiceTemplate]=useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({}),
    [reference, setReference] = useState(""),
    [proof, setProof] = useState(""),
    [verified, setVerified] = useState(false),
    [due, setDue] = useState(""),
    [cashReceived, setCashReceived] = useState("");
  const submitting = useRef(false),
    config = useShopConfiguration();
  const products = useQuery({
      queryKey: ["staff-products"],
      queryFn: staffService.products,
    }),
    checkout = useQuery({
      queryKey: ["mobile-sale-checkout"],
      queryFn: async () => ({
        settings: await r.settings.get(),
        methods: await r.payments.list(),
      }),
    });
  const all = (products.data?.data ?? []).map((row) =>
    posModel(
      row,
      row.primary_image_url
        ? row.primary_image_url.startsWith("http")
          ? row.primary_image_url
          : "taha-media:" + row.primary_image_url
        : "",
    ),
  );
  const matches = searchProducts(all, search).slice(0, 40),
    settings = checkout.data?.settings;
  const tax = quoteTax(
    draft.items,
    0,
    settings?.taxProfiles,
    settings?.defaultTaxProfileId,
  );
  const methods = (checkout.data?.methods ?? []).filter(
    (m) =>
      m.enabled &&
      (m.kind !== "Credit" ||
        (settings?.creditEnabled &&
          config.configuration?.enabledFeatures.credit !== false &&
          staffService.allow("credit.create"))) &&
      (m.kind !== "Digital" ||
        staffService.allow("payments.approve_electronic")),
  );
  const selected = methods.filter((m) => Number(amounts[m.id]) > 0),
    cashDue = selected
      .filter((m) => m.kind === "Cash")
      .reduce((n, m) => n + Number(amounts[m.id]), 0),
    digital = selected.some((m) => m.kind === "Digital"),
    credit = selected.some((m) => m.kind === "Credit");
  const allocated = selected.reduce(
      (n, m) => n + Math.round(Number(amounts[m.id]) * 100),
      0,
    ),
    proofRequired =
      digital &&
      (settings?.requireProof ||
        selected.some((m) => m.kind === "Digital" && m.requiresProof));
  const locked = !!draft.submitted;
  useEffect(() => {
    try {
      saveMobileDraft(scope, draft);
    } catch {
      setError(
        "This phone could not save the draft. Keep this screen open until checkout is accepted.",
      );
    }
  }, [draft, scope]);
  useEffect(() => {
    const value =
      params.get("code") ||
      products.data?.data.find((p) => p.id === params.get("id"))?.internal_code;
    if (value) {
      setSearch(value);
      if (!draft.submitted) setStep("search");
    }
  }, [params, draft.submitted, products.data]);
  const update = (next: Partial<MobileDraft>) => {
    if (!locked && !busy) {
      setDraft((old) => ({ ...old, ...next }));
      setError("");
    }
  };
  const append = (product: PosProduct,priceReason?:string) => {
    if (locked) return;
    const item = draft.items.find((i) => i.product.id === product.id);
    if (
      product.category !== "Services" &&
      (item?.quantity ?? 0) >= product.quantity
    )
      return;
    update({
      items: item
        ? draft.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          )
        : [
            ...draft.items,
            { product, quantity: 1, unitPrice: product.sellingPrice,priceReason },
          ],
    });
  };
  const add=(product:PosProduct,priceReason?:string)=>{
    if(locked)return;
    if(product.category==='Services'&&!product.customService){
      void r.services.list().then(templates=>{const template=templates.find(item=>item.id===product.id);if(template?.linkedProductId){setServiceTemplate(template.id);setService(true);}else append(product,priceReason);}).catch(()=>setError('Cannot review this service. Reconnect and try again.'));
    }else append(product,priceReason);
  };
  const beginPayment = () => {
    const cash = methods.find((m) => m.kind === "Cash");
    if (cash && !Object.keys(amounts).length)
      setAmounts({ [cash.id]: String(tax.total) });
    setCashReceived(String(tax.total));
    setStep("payment");
  };
  const pickProof = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setError("Choose an image up to 8 MB.");
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read this photo."));
        reader.readAsDataURL(file);
      });
      setProof(data);
      setVerified(false);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const complete = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const input: SaleInput = draft.submitted ?? {
      cartId: draft.cartId,
      idempotencyKey: draft.checkoutId,
      lines: draft.items.map((i) => ({
        productId: i.product.id,
        customService: i.product.customService,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        reason:i.priceReason,
        approval:i.approval,
      })),
      customerId: draft.customerId,
      coupon: "",
      payments: selected.map((m) => ({
        methodId: m.id,
        amount: Number(amounts[m.id]),
        reference: m.kind === "Digital" ? reference : "",
        proof: m.kind === "Digital" ? proof : "",
        verified: m.kind === "Digital" ? verified : false,
      })),
      cashReceived: Number(cashReceived) || 0,
      ...(credit ? { creditDueAt: due } : {}),
    };
    setDraft((old) => ({ ...old, submitted: input }));
    try {
      saveMobileDraft(scope, { ...draft, submitted: input });
      const accepted = await completeMobileSale(input, (prepared) => {
        const pending = { ...draft, submitted: prepared };
        saveMobileDraft(scope, pending);
        setDraft(pending);
      });
      setSale(accepted);
      setSearch("");
      const next = emptyMobileDraft();
      saveMobileDraft(scope, next);
      setDraft(next);
      void products.refetch();
    } catch (cause) {
      setError((cause as Error).message);
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500
      )
        setDraft((old) => ({
          ...old,
          submitted: undefined,
        })); /* Lost responses retain the exact payload/key. Rejected transactions can be corrected. */
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (config.isPending)
    return (
      <div className="staff-page" role="status">
        Loading shop sales settings…
      </div>
    );
  if (config.error)
    return (
      <div className="staff-page">
        <h1>Mobile Sales</h1>
        <p role="alert">
          Cannot load shop sales settings. Reconnect and retry.
        </p>
      </div>
    );
  if (!config.configuration?.enabledFeatures.mobileSales)
    return (
      <div className="staff-page">
        <h1>Mobile Sales</h1>
        <p>
          Enable Mobile Sales in Review Shop Setup before taking sales on this
          phone.
        </p>
      </div>
    );
  if (sale)
    return (
      <div className="staff-page mobile-sales">
        <section className="panel mobile-sale-success">
          <CheckCircle2 size={42} />
          <h1>Sale Complete</h1>
          <strong>{sale.invoice}</strong>
          <p>{currency(sale.total)}</p>
          <p>Accepted by the shop · payment and stock recorded.</p>
        </section>
        <div className="mobile-sale-actions">
          <Button onClick={() => setReceipt(!receipt)}>View Receipt</Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void shareMobileReceipt(sale)
                .catch((c) => setError(c.message))
                .finally(() => setBusy(false));
            }}
          >
            Share PDF
          </Button>
          <Button
            disabled={!sale.receiptUrl}
            onClick={() =>
              void navigator.clipboard
                .writeText(sale.receiptUrl!)
                .then(() => toast("Receipt link copied"))
                .catch(() =>
                  setError(
                    "Could not copy. Open the receipt and copy its reference.",
                  ),
                )
            }
          >
            Copy Receipt Link
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setSale(null);
              setReceipt(false);
              setStep("search");
              setAmounts({});
              setProof("");
              setVerified(false);
              setReference("");
              setDue("");
              setError("");
            }}
          >
            New Sale
          </Button>
        </div>
        <label className="form-field">
          WhatsApp number (optional)
          <input
            className="input"
            inputMode="tel"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="03XX XXXXXXX"
          />
        </label>
        <Button
          disabled={!sale.receiptUrl}
          onClick={() => {
            try {
              openMobileWhatsapp(search, sale);
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        >
          Open WhatsApp
        </Button>
        <p className="mobile-sale-note">
          Sharing prepares a file or message. It does not confirm delivery.
        </p>
        {receipt && (
          <section className="mobile-sale-paper" aria-label="Receipt">
            <h2>{sale.receipt?.storeName || "Taha Mobiles"}</h2>
            <p>{sale.invoice}</p>
            <p>{sale.customerName}</p>
            {sale.lines.map((line, i) => (
              <div className="mobile-sale-total" key={i}>
                <small>
                  {line.name} × {line.quantity}
                </small>
                <small>{currency(line.total)}</small>
              </div>
            ))}
            <div className="mobile-sale-total">
              <strong>Total</strong>
              <strong>{currency(sale.total)}</strong>
            </div>
            <p>
              Paid {currency(sale.paid ?? 0)} · Outstanding{" "}
              {currency(sale.outstanding ?? 0)}
            </p>
            <p>{sale.receipt?.footer}</p>
          </section>
        )}
        {error && (
          <p role="alert" className="mobile-sale-error">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="staff-page mobile-sales">
      {step !== "search" && (
        <Button
          className="mobile-sale-back"
          disabled={busy || locked}
          onClick={() => setStep(step === "payment" ? "cart" : "search")}
        >
          <ArrowLeft size={16} />
          Back
        </Button>
      )}
      <div className="staff-page-heading">
        <span className="eyebrow">MOBILE SALES</span>
        <h1>
          {step === "search"
            ? "New Sale"
            : step === "cart"
              ? "Review Cart"
              : "Choose Payment"}
        </h1>
        <p>
          {step === "search"
            ? "Search or scan, then add items."
            : step === "cart"
              ? "Review quantities and optional customer."
              : "Record the payment received, then complete."}
        </p>
      </div>
      {step === "search" && (
        <>
          <label className="staff-search">
            <Search size={22} />
            <input
              aria-label="Search sale products"
              value={search}
              placeholder="Name, model or barcode…"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="mobile-sale-actions">
            <Button
              disabled={locked}
              onClick={() => window.dispatchEvent(new Event("taha-scan-open"))}
            >
              <ScanLine size={18} />
              Scan Items
            </Button>
            {staffService.allow("services.create_custom") && (
              <Button disabled={locked} onClick={() => {setServiceTemplate('');setService(true);}}>
                Custom Service
              </Button>
            )}
          </div>
          {products.data?.cached && (
            <p className="staff-cache-label">
              Saved lookup · Stock may have changed. Checkout requires shop
              acceptance.
            </p>
          )}
          {products.isPending && <p role="status">Loading products…</p>}
          {products.isError && <p role="alert">{products.error.message}</p>}
          <div className="staff-product-list">
            {matches.map((p) => (
              <button
                className="panel staff-product-row"
                key={p.id}
                aria-label={"Add " + p.name}
                disabled={
                  locked ||
                  (p.category !== "Services" &&
                    p.quantity <=
                      (draft.items.find((i) => i.product.id === p.id)
                        ?.quantity ?? 0))
                }
                onClick={() => add(p)}
              >
                <span className="staff-product-image">
                  {p.image ? (
                    <MediaImage src={p.image} alt="" thumbnail />
                  ) : (
                    <Package size={24} />
                  )}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {[p.compatibleModel, p.qualityGrade, p.color]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <span className="staff-product-price">
                    {currency(p.sellingPrice)}
                  </span>
                </span>
                <span className="staff-stock-count">
                  {p.category === "Services" ? "Service" : p.quantity}
                  <small>
                    {p.category === "Services" ? "Saved service" : "available"}
                  </small>
                  <Plus size={18} />
                </span>
              </button>
            ))}
          </div>
          {!matches.length && !products.isPending && !products.isError && (
            <section className="staff-empty">
              <h2>Product not found</h2>
              <p>
                Add a tracked catalogue item, or describe labour as a custom
                service.
              </p>
              <div className="mobile-sale-actions">
                {staffService.allow("products.create") && (
                  <Button onClick={() => setCreateProduct(true)}>
                    Add Product
                  </Button>
                )}
                {staffService.allow("services.create_custom") && (
                  <Button onClick={() => {setServiceTemplate('');setService(true);}}>
                    Add Custom Service
                  </Button>
                )}
              </div>
            </section>
          )}
          {draft.items.length > 0 && (
            <Button
              className="mobile-sale-cart-bar"
              variant="primary"
              onClick={() => setStep("cart")}
            >
              View Cart · {draft.items.reduce((n, i) => n + i.quantity, 0)}{" "}
              items · {currency(tax.total)}
            </Button>
          )}
        </>
      )}
      {step === "cart" && (
        <>
          <CustomerCombobox
            value={draft.customerId}
            onSelect={(id) => update({ customerId: id })}
          />
          {draft.items.map((item) => (
            <article className="panel mobile-sale-line" key={item.product.id}>
              <div>
                <strong>{item.product.name}</strong>
                <small>
                  {currency(item.unitPrice)} each
                  {item.product.customService?.material
                    ? ` · Includes ${item.product.customService.material.quantity} ${item.product.compatibleModel||'linked part'}`
                    : ""}
                </small>
                <b>{currency(item.quantity * item.unitPrice)}</b>
              </div>
              <div className="mobile-quantity">
                {item.product.customService&&<Button aria-label={'Edit '+item.product.name+' price'} disabled={locked||busy} onClick={()=>{void products.refetch();setEditing(item.product.id);}}><Pencil size={16}/></Button>}
                <Button
                  aria-label={"Decrease " + item.product.name}
                  disabled={locked || item.quantity <= 1}
                  onClick={() =>
                    update({
                      items: draft.items.map((i) =>
                        i === item ? { ...i, quantity: i.quantity - 1 } : i,
                      ),
                    })
                  }
                >
                  <Minus size={16} />
                </Button>
                <span aria-label="Quantity">{item.quantity}</span>
                <Button
                  aria-label={"Increase " + item.product.name}
                  disabled={
                    locked ||
                    (item.product.category !== "Services" &&
                      item.quantity >= item.product.quantity)
                  }
                  onClick={() => add(item.product)}
                >
                  <Plus size={16} />
                </Button>
                <Button
                  aria-label={"Remove " + item.product.name}
                  disabled={locked}
                  onClick={() =>
                    update({ items: draft.items.filter((i) => i !== item) })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </article>
          ))}
          <Totals total={tax.total} tax={tax.amount} name={tax.name} />
          <Button
            variant="primary"
            disabled={
              !draft.items.length ||
              checkout.isPending ||
              checkout.isError ||
              !methods.length
            }
            onClick={beginPayment}
          >
            Choose Payment
          </Button>
        </>
      )}
      {step === "payment" && (
        <>
          <Totals total={tax.total} tax={tax.amount} name={tax.name} />
          <p className="mobile-sale-note">
            Use one method or enter portions to split payment. No money is
            transferred automatically.
          </p>
          {locked ? (
            <p className="auth-notice">
              The submitted request is preserved. Retry checks the same sale
              safely; do not take another payment. If the counter must
              synchronize first, synchronize it and retry here.
            </p>
          ) : (
            <>
              {methods.map((m) => (
                <label className="mobile-payment-row" key={m.id}>
                  <span>
                    <strong>{m.name}</strong>
                    <small>
                      {m.kind === "Digital"
                        ? [m.title, m.number, m.iban]
                            .filter(Boolean)
                            .join(" · ")
                        : m.kind === "Credit"
                          ? "Customer credit"
                          : "Cash received at shop"}
                    </small>
                  </span>
                  <input
                    className="input"
                    aria-label={m.name + " amount (PKR)"}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amounts[m.id] ?? ""}
                    onChange={(e) => {
                      setAmounts({ ...amounts, [m.id]: e.target.value });
                      setVerified(false);
                    }}
                  />
                </label>
              ))}
              <p>
                Unallocated:{" "}
                {currency((Math.round(tax.total * 100) - allocated) / 100)}
              </p>
              {cashDue > 0 && (
                <label className="form-field">
                  Cash received (PKR)
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={cashDue}
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                  <small>
                    Change{" "}
                    {currency(Math.max(0, Number(cashReceived) - cashDue))}
                  </small>
                </label>
              )}
              {credit && (
                <>
                  <p className="auth-notice">
                    Credit requires a selected customer with credit enabled. The
                    server checks their limit.
                  </p>
                  <CustomerCombobox
                    value={draft.customerId}
                    onSelect={(id) => update({ customerId: id })}
                  />
                  <label className="form-field">
                    Payment due
                    <DateTimeInput
                      label="Mobile payment due"
                      value={due}
                      onChange={setDue}
                      required={settings?.creditDueRequired}
                    />
                  </label>
                </>
              )}
              {digital && (
                <section className="panel mobile-sale-proof">
                  <label className="form-field">
                    Transfer reference
                    <input
                      className="input"
                      value={reference}
                      onChange={(e) => {
                        setReference(e.target.value);
                        setVerified(false);
                      }}
                    />
                  </label>
                  <strong>
                    Payment proof{proofRequired ? " · Required" : " · Optional"}
                  </strong>
                  <label className="form-field">
                    Use phone camera
                    <input
                      aria-label="Use phone camera"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => void pickProof(e.target.files?.[0])}
                    />
                  </label>
                  <label className="form-field">
                    Choose from gallery
                    <input
                      aria-label="Choose from gallery"
                      type="file"
                      accept="image/*"
                      onChange={(e) => void pickProof(e.target.files?.[0])}
                    />
                  </label>
                  {proof && <p>Proof photo ready for private upload.</p>}
                  <label className="checkbox-field">
                    <AppCheckbox
                      checked={verified}
                      onChange={(e) => setVerified(e.target.checked)}
                    />
                    Payment received and verified
                  </label>
                </section>
              )}
            </>
          )}
          <section className="panel mobile-sale-summary">
            <h2>Final review</h2>
            {draft.items.map((i) => (
              <p key={i.product.id}>
                {i.product.name} × {i.quantity} ·{" "}
                {currency(i.quantity * i.unitPrice)}
              </p>
            ))}
            <p className="mobile-sale-note">
              Checkout requires backend acceptance. Active Windows offline
              authorization or unresolved counter activity can block mobile
              sales until synchronized or reconciled.
            </p>
          </section>
          <Button
            variant="primary"
            disabled={
              busy ||
              checkout.isPending ||
              checkout.isError ||
              (!locked &&
                (allocated !== Math.round(tax.total * 100) ||
                  !selected.length ||
                  Object.values(amounts).some(
                    (v) => !Number.isFinite(Number(v)) || Number(v) < 0,
                  ) ||
                  (cashDue > 0 && Number(cashReceived) < cashDue) ||
                  (digital &&
                    (!verified ||
                      (proofRequired && !proof) ||
                      (settings?.requirePaymentReference &&
                        !reference.trim()))) ||
                  (credit &&
                    (!draft.customerId ||
                      (settings?.creditDueRequired && !due)))))
            }
            onClick={() => void complete()}
          >
            {busy
              ? "Completing…"
              : locked
                ? "Retry Same Sale"
                : "Complete Sale"}
          </Button>
        </>
      )}
      {checkout.isError && (
        <p role="alert" className="mobile-sale-error">
          Cannot load payment settings. Reconnect before checkout.
        </p>
      )}
      {error && (
        <p role="alert" className="mobile-sale-error">
          {error}
        </p>
      )}
      {service && (
        <MobileServiceDialog
          open
          onClose={() => setService(false)}
          products={all}
          onAdd={add}
          initialTemplateId={serviceTemplate||undefined}
        />
      )}
      {editing&&draft.items.find(item=>item.product.id===editing)&&<MobileServicePrice item={draft.items.find(item=>item.product.id===editing)!} products={all} onClose={()=>setEditing('')} onSave={item=>update({items:draft.items.map(old=>old.product.id===item.product.id?item:old)})}/>}
      {createProduct && (
        <MobileQuickProduct
          name={search}
          onClose={() => setCreateProduct(false)}
          onSaved={() => {
            void products.refetch();
            setCreateProduct(false);
            setSearch("");
          }}
        />
      )}
    </div>
  );
}
function Totals({
  total,
  tax,
  name,
}: {
  total: number;
  tax: number;
  name: string;
}) {
  return (
    <div className="panel mobile-sale-detail">
      {tax > 0 && (
        <div className="mobile-sale-total">
          <small>{name}</small>
          <small>{currency(tax)}</small>
        </div>
      )}
      <div className="mobile-sale-total">
        <strong>Total</strong>
        <strong>{currency(total)}</strong>
      </div>
    </div>
  );
}
function MobileQuickProduct({
  name: initial,
  onClose,
  onSaved,
}: {
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial),
    [price, setPrice] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [id] = useState(() => crypto.randomUUID());
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title="Add Product"
      description="Create a physical catalogue item. Receive stock separately before selling it."
      className="bottom-sheet mobile-service-sheet"
    >
      <label className="form-field">
        Product name
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={180}
        />
      </label>
      <label className="form-field">
        Selling price (PKR)
        <input
          className="input"
          type="number"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <p>
        No opening stock is added. This item stays unavailable until stock is
        received.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={
            busy ||
            !name.trim() ||
            !Number.isFinite(Number(price)) ||
            Number(price) <= 0
          }
          variant="primary"
          onClick={() => {
            setBusy(true);
            void r.products
              .save({
                id,
                name: name.trim(),
                category: "Accessories",
                brand: "",
                compatibleModel: "",
                qualityGrade: "",
                color: "",
                sellingPrice: Number(price),
                minimumSellingPrice: 0,
                aliases: [],
                lowStockLevel: 0,
                state: "active",
                locationId: "",
                variant: "",
                unit: "pcs",
                notes: "",
                image: "",
                initialQuantity: 0,
              })
              .then(onSaved)
              .catch((c) => setError(c.message))
              .finally(() => setBusy(false));
          }}
        >
          Save Product
        </Button>
      </div>
    </Dialog>
  );
}
