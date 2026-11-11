import {Field} from '../ui/workspace';
import { quoteTax } from '../../lib/tax';
import {nativeDesktop} from '../../lib/desktop/runtime';
import {useSyncStore} from '../../stores/sync-store';
import { Banknote, CreditCard, Wallet, ArrowRight, CheckCircle2, Monitor } from 'lucide-react';
import { AppSelect } from '../ui/app-select';
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { PermissionToggle } from "../ui/workspace";
import { useSessionStore } from "../../stores/session-store";
import { useCartStore } from "../../stores/cart-store";
import { repositories as r } from "../../lib/repositories";
import { useRepository, useAction } from "../../hooks/use-repository";
import { cartTotals } from "../../lib/cart";
import { usePermission } from "../../hooks/use-permission";
import { currency } from "../../lib/utils";
import type { PaymentAllocation } from "../../types/demo";
import { PaymentQr } from "./payment-qr";
import { localDemoEnabled } from "../../lib/config";
import {ManagerApproval} from "./manager-approval";
import {ProofUploader} from "./proof-uploader";
import { CustomerCombobox } from "./customer-combobox";
import { resetDisplayToCart, publishCustomerDisplay, displayPaymentFromMethod } from "../../hooks/use-customer-display";
import {Keyboard} from "lucide-react";
import {useKeyboardStore} from "../../stores/keyboard-store";
import {DateTimeInput} from '../ui/date-time-input';
export function CheckoutDialog() {
  const open = useSessionStore((s) => s.checkoutOpen);
  return open ? <CheckoutForm /> : null;
}
function CheckoutForm() {
  const cart = useCartStore();
  const session = useSessionStore();
  const open = session.checkoutOpen;
  const a = useAction();
  const offline=useSyncStore(s=>nativeDesktop&&s.status==='OFFLINE');
  const electronicPermission = usePermission("payments.approve_electronic");
  const creditPermission = usePermission("credit.create");
  const canElectronic=electronicPermission&&!offline,canCredit=creditPermission&&!offline;
  const navigate = useNavigate();
  const q = useRepository("checkout-data", async () => ({
    coupons:offline?[]:await r.coupons.list(),
    methods: (await r.payments.list()).filter((m) => m.enabled&&(!offline||m.kind==='Cash')),
    settings: await r.settings.get(),
    customers: await r.customers.list(),
    balance: cart.customerId && canCredit
      ? await r.customers.outstanding(cart.customerId)
      : 0,
  }));
  const baseTotals = cartTotals(cart.items, cart.couponDiscount);
  const tax = quoteTax(cart.items,cart.couponDiscount,q.data?.settings.taxProfiles,q.data?.settings.defaultTaxProfileId,q.data?.coupons.find(c=>c.code===cart.couponCode));
  const totals = {...baseTotals,total:tax.total};
  const [review,setReview] = useState(false);
  const [skipProof,setSkipProof] = useState(false);
  const [selection, setSelected] = useState("cash");
  const [cashReceived, setCashReceived] = useState(totals.total);
  const [splitCash, setSplitCash] = useState(totals.total / 2);
  const [splitSelection, setSplitMethod] = useState("jazzcash");
  const [splitCredit, setSplitCredit] = useState(0);
  const priorTotal=useRef(totals.total);
  useEffect(()=>{const previous=priorTotal.current;setCashReceived(old=>old===previous?totals.total:old);setSplitCash(old=>old===previous/2?totals.total/2:old);priorTotal.current=totals.total;},[totals.total]);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [id] = useState(() => cart.checkoutId);
  const [paymentApproval,setPaymentApproval] = useState("");
  const [creditOverrideReason,setCreditOverrideReason] = useState("");
  const cashMethod = q.data?.methods.find(m=>m.kind==="Cash");
  const selected = selection==="split" || q.data?.methods.some(m=>m.id===selection) ? selection : cashMethod?.id ?? "";
  const splitMethod = q.data?.methods.some(m=>m.id===splitSelection) ? splitSelection : q.data?.methods.find(m=>m.kind!=="Cash")?.id ?? "";
  const [customer, setCustomer] = useState(cart.customerId);
  const [creditDueAt,setCreditDueAt]=useState<string|null>(null);
  const paymentDue=creditDueAt??q.data?.customers.find(c=>c.id===customer)?.dueAt??'';
  useEffect(()=>setCreditDueAt(null),[customer]);
  const balance = useRepository("checkout-balance-" + customer, () =>
    customer && canCredit ? r.customers.outstanding(customer) : Promise.resolve(0),
  );
  const method = q.data?.methods.find(
    (m) => m.id === (selected === "split" ? splitMethod : selected),
  );
  const isDigital = method?.kind === "Digital";
  useEffect(() => {
    if (!open) return;
    publishCustomerDisplay({ mode: "CHECKOUT", payment: undefined }, "checkout.started");
  }, [open]);
  const cashDue =
    selected === "split"
      ? splitCash
      : method?.kind === "Cash"
        ? totals.total
        : 0;
  const creditMethod = q.data?.methods.find((m) => m.kind === "Credit");
  const extraCredit =
    selected === "split" && method?.kind !== "Credit" ? splitCredit : 0;
  const remaining =
    Math.round((totals.total - splitCash - extraCredit) * 100) / 100;
  const credit = method?.kind === "Credit" || extraCredit > 0;
  useEffect(() => {
    if (!open || !method) return;
    const paymentTotal = selected === "split" && method.kind === "Digital" ? Math.max(0, remaining) : totals.total;
    publishCustomerDisplay({ mode: "PAYMENT", total:totals.total, tax:{name:tax.name,rate:tax.rate,mode:tax.mode,amount:tax.amount}, payment: displayPaymentFromMethod(method, paymentTotal, {
      cashReceived: method.kind === "Cash" ? cashReceived : undefined,
      change: Math.max(0, cashReceived - cashDue),
      paidNow: method.kind === "Credit" ? (selected === "split" ? splitCash : 0) : selected === "split" ? totals.total - extraCredit : totals.total,
      outstanding: method.kind === "Credit" ? (selected === "split" ? remaining : totals.total) : extraCredit,
    }) }, "payment.method.changed");
  }, [open, method, selected, remaining, totals.total, cashReceived, cashDue, splitCash, extraCredit, tax.name, tax.rate, tax.mode, tax.amount]);
  useEffect(() => { setPaymentApproval(""); setConfirmed(false); }, [selected, splitMethod, splitCash, splitCredit, reference, proof, totals.total]);
  useEffect(()=>setReview(false),[selected,splitMethod,splitCash,splitCredit,reference,proof,totals.total,customer,cashReceived,confirmed]);
  const close = () => { resetDisplayToCart(); session.setCheckoutOpen(false); };
  const submit = () => {
    const payment = (methodId: string, amount: number): PaymentAllocation => ({
      methodId,
      amount,
      reference,
      proof,
      verified: confirmed,
      approvalToken: paymentApproval || undefined,
    });
    const allocations =
      selected === "split"
        ? [
            payment(cashMethod?.id ?? "cash", splitCash),
            payment(splitMethod, remaining),
            ...(extraCredit > 0 && creditMethod
              ? [payment(creditMethod.id, extraCredit)]
              : []),
          ]
        : [payment(selected, totals.total)];
    void a.run(
      () =>
        r.sales.complete({
          lines: cart.items.map((i) => ({
            productId: i.product.id,
            customService: i.product.customService,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            reason: i.priceReason,
            approval: i.approval,
          })),
          customerId: customer,
          coupon: cart.couponCode,
          payments: allocations,
          cashReceived,
          sourceTestId: cart.sourceTestId,
          idempotencyKey: id,
          cartId: cart.cartId,
          creditOverrideReason,
          creditDueAt:credit?paymentDue:undefined,
        }),
      "Sale completed",
      (sale) => {
        const payment = sale.payments[0];
        const saleMethod = q.data?.methods.find((m) => m.id === payment?.methodId);
        publishCustomerDisplay({ mode: "SALE_COMPLETE", invoiceNumber: sale.invoice, saleId: sale.id, receiptUrl:sale.receiptUrl,total: sale.total, payment: saleMethod ? displayPaymentFromMethod(saleMethod, sale.total, { paidNow: sale.paid ?? sale.payments.filter(p => q.data?.methods.find(m => m.id === p.methodId)?.kind !== "Credit").reduce((sum, p) => sum + p.amount, 0), outstanding: sale.outstanding ?? sale.payments.filter(p => q.data?.methods.find(m => m.id === p.methodId)?.kind === "Credit").reduce((sum,p) => sum+p.amount,0), cashReceived: sale.cashReceived ?? cashReceived, change: sale.change ?? Math.max(0,cashReceived-cashDue) }) : undefined, completedAt: new Date().toISOString() });
        cart.clear();
        session.setCheckoutOpen(false);
        navigate("/sale-complete/" + sale.id);
      },
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !a.busy) close();
      }}
      title="Checkout"
      description="Choose payment details, review the order, then complete the sale."
      className="checkout-dialog-v2"
    >
      <div className="checkout-steps"><span className="done">Customer</span><ArrowRight size={13}/><span className={review?"done":"active"}>Payment</span><ArrowRight size={13}/><span className={review?"active":""}>Review</span></div>
      <div className="checkout-total">
        <span>Total to Pay</span>
        <strong>{currency(totals.total)}</strong>
      </div>
      <div className="payment-options">
        {q.data?.methods
          .filter((m) => m.kind !== "Credit" || q.data.settings.creditEnabled)
          .map((m) => (
            <button
              key={m.id}
              disabled={
                (localDemoEnabled && m.kind === "Digital" && !canElectronic) ||
                (m.kind === "Credit" && !canCredit)
              }
              className={selected === m.id ? "selected" : ""}
              onClick={() => {
                setSelected(m.id);
                setConfirmed(false);
                setPaymentApproval("");
              }}
            >
              {m.kind==="Cash"?<Banknote size={18}/>:m.kind==="Credit"?<Wallet size={18}/>:<CreditCard size={18}/>}<span>{m.name}<small>{m.kind==="Digital"?m.title||"Digital account":m.kind==="Credit"?"Customer credit":"Cash at counter"}</small></span>
            </button>
          ))}
        <button
          className={selected === "split" ? "selected" : ""}
          disabled={
            !q.data?.methods.some(
              (m) => m.kind === "Cash",
            ) ||
            !q.data?.methods.some(
              (m) =>
                m.kind !== "Cash" &&
                (!localDemoEnabled || m.kind !== "Digital" || canElectronic) &&
                (m.kind !== "Credit" || q.data.settings.creditEnabled),
            )
          }
          onClick={() => setSelected("split")}
        >
          <Wallet size={18}/><span>Split Payment<small>Allocate across methods</small></span>
        </button>
      </div>
      <div className="form-field mt-4">
        <span>Customer</span>
        <CustomerCombobox value={customer} disabled={!!cart.sourceTestId} onSelect={id => {
          setCustomer(id);
          useCartStore.setState({ customerId: id });
          cart.setCoupon(false);
          publishCustomerDisplay({}, "customer.selected");
        }}/>
      </div>
      {selected === "split" && (
        <div className="form-grid mt-4">
          <label className="form-field">
            Cash portion (PKR)
            <input
              className="input"
              type="number"
              min="0.01"
              max={totals.total - 0.01}
              value={splitCash}
              onChange={(e) => setSplitCash(Number(e.target.value))}
            />
          </label>
          <Field label="Remaining method"><AppSelect
              className="input"
              value={splitMethod}
              onChange={(e) => {
                setSplitMethod(e.target.value);
                setSplitCredit(0);
              }}
            >
              {q.data?.methods
                .filter(
                  (m) =>
                    m.kind !== "Cash" &&
                    (m.kind !== "Credit" || q.data.settings.creditEnabled),
                )
                .map((m) => (
                  <option
                    disabled={
                      (localDemoEnabled && m.kind === "Digital" && !canElectronic) ||
                      (m.kind === "Credit" && !canCredit)
                    }
                    key={m.id}
                    value={m.id}
                  >
                    {m.name}
                  </option>
                ))}
            </AppSelect></Field>
          {method?.kind !== "Credit" &&
            q.data?.settings.creditEnabled &&
            creditMethod &&
            canCredit && (
              <label className="form-field">
                Credit portion (PKR, optional)
                <input
                  className="input"
                  type="number"
                  min="0"
                  max={Math.max(0, totals.total - splitCash - 0.01)}
                  step="0.01"
                  value={splitCredit}
                  onChange={(e) => setSplitCredit(Number(e.target.value))}
                />
              </label>
            )}
          <p>Remaining: {currency(remaining)}</p>
        </div>
      )}
      {cashDue > 0 && (
        <div className="mt-4">
          <label className="form-field">
            Cash received (PKR)
            <input
              className="input"
              type="number"
              min={cashDue}
              value={cashReceived}
              onChange={(e) => setCashReceived(Number(e.target.value))}
            />
          </label>
          <div className="summary-line mt-3">
            <span>Change</span>
            <strong>{currency(Math.max(0, cashReceived - cashDue))}</strong>
          </div>
        </div>
      )}
      {credit && (
        <p className="auth-notice">
          Credit is added to the selected account. Current balance:{" "}
          {currency(balance.data ?? 0)}.{" "}
          <Link className="text-link" to="/credit/new" onClick={close}>
            Create account
          </Link>
        </p>
      )}
      {credit&&<label className="form-field mt-3">Payment due date and time{q.data?.settings.creditDueRequired?' (required)':''}<DateTimeInput label="Payment due date and time" value={paymentDue} onChange={setCreditDueAt} required={q.data?.settings.creditDueRequired}/><small>Pakistan Standard Time · independent of the customer's credit limit.</small></label>}
      {isDigital && (
        <section className="payment-account mt-4">
          <strong>{method?.title}</strong>
          <p>{method?.number}</p>
          <p>{method?.iban}</p>
          <PaymentQr image={method?.qr} name={method?.name ?? "Payment"} />
          <label className="form-field mt-3">
            Transfer reference
            <input
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <div className="checkout-proof-heading"><strong>Payment Proof</strong><small>{q.data?.settings.requireProof||method?.requiresProof?"Required before completing sale":"Optional · staff only"}</small></div>
          <ProofUploader
            value={proof}
            onChange={setProof}
            amount={selected === "split" ? remaining : totals.total}
          />
          {!(q.data?.settings.requireProof||method?.requiresProof)&&!proof&&<Button size="small" variant="ghost" onClick={()=>setSkipProof(true)}>Skip Payment Proof</Button>}
          {skipProof&&!proof&&<p className="text-muted text-xs">Payment proof skipped. Verify the payment before proceeding.</p>}
          <p className="checkout-display-note"><Monitor size={15}/>Payment details are shown on the customer display.<a className="text-link" href="/customer-display" target="_blank" rel="noopener">Preview Customer Screen</a></p>
          {canElectronic && <PermissionToggle
            label="Payment received and verified"
            checked={confirmed}
            onChange={setConfirmed}
          />}
          {!localDemoEnabled && !canElectronic && (paymentApproval ? <p className="text-success">Manager verification attached. Changing payment details requires a new approval.</p> : <ManagerApproval purpose="payment" payload={{cartId:cart.cartId,methodId:method!.id,amount:selected==="split"?remaining:totals.total,reference,proof}} onApproved={setPaymentApproval}/>)}
        </section>
      )}
      {credit && !localDemoEnabled && <label className="form-field mt-3">Credit limit override reason (only if authorized)<input className="input" value={creditOverrideReason} onChange={e=>setCreditOverrideReason(e.target.value)}/></label>}
      {review&&<section className="checkout-review" aria-label="Final sale review"><h3><CheckCircle2 size={18}/>Review Sale</h3><p>{q.data?.customers.find(item=>item.id===customer)?.name||"Walk-in Customer"} · {selected==="split"?"Split Payment":method?.name}</p><div className="summary-line"><span>Items</span><strong>{cart.items.reduce((sum,item)=>sum+item.quantity,0)}</strong></div><div className="summary-line"><span>Subtotal after discounts</span><strong>{currency(tax.mode==="Inclusive"?tax.net:totals.total-tax.amount)}</strong></div>{(tax.amount>0||q.data?.settings.showZeroTax)&&<div className="summary-line"><span>{tax.name} ({tax.rate}%, {tax.mode.toLowerCase()})</span><strong>{currency(tax.amount)}</strong></div>}<div className="summary-line"><strong>Total</strong><strong>{currency(totals.total)}</strong></div><small>Complete Sale records the payment and updates inventory.</small></section>}
      {a.error && (
        <p className="text-danger mt-4" role="alert">
          {a.error}
        </p>
      )}
      <div className="dialog-actions"><Button size="small" onClick={()=>useKeyboardStore.getState().setOpen(true)}><Keyboard size={16}/>Keyboard</Button>
        <Button onClick={close} disabled={a.busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={
            a.busy ||
            q.isPending ||
            !method ||
            (isDigital && (canElectronic ? !confirmed : !paymentApproval)) ||
            (isDigital && (q.data?.settings.requireProof || method?.requiresProof) && !proof) || (isDigital && q.data?.settings.requirePaymentReference && !reference.trim()) ||
            (credit && !customer) ||
            (credit && q.data?.settings.creditDueRequired===true&&!paymentDue) ||
            (credit && !canCredit) ||
            (selected === "split" &&
              (splitCash <= 0 ||
                remaining <= 0 ||
                extraCredit < 0 ||
                !Number.isFinite(extraCredit))) ||
            cashReceived < cashDue
          }
          onClick={()=>review?submit():setReview(true)}
        >
          {a.busy ? "Completing…" : review ? "Complete Sale" : "Review Sale"}
        </Button>
      </div>
      <p className="text-xs text-muted mt-3">
        {localDemoEnabled ? "LOCAL DEMO · No real payment is processed." : "Records payments received. External transfers and refunds are performed manually."}
      </p>
    </Dialog>
  );
}
