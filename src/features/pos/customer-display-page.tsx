import { useState } from "react";
import {nativeDesktop} from '../../lib/desktop/runtime';
import { useRemoteCustomerDisplay } from "../../hooks/use-remote-customer-display";
import { Button } from "../../components/ui/button";
import { MonitorDot } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useCustomerDisplay, localPairingCode } from "../../hooks/use-customer-display";
import { currency } from "../../lib/utils";
import { Logo } from "../../components/ui/logo";
import { useRepository } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import { localDemoEnabled, apiEnabled } from "../../lib/config";
import { PaymentQr } from "../../components/pos/payment-qr";
import { useSessionStore } from "../../stores/session-store";
import { useUiStore } from "../../stores/ui-store";
import type { CustomerDisplayState } from "../../types/phase4b";

export function CustomerDisplayPage() {
  const [params] = useSearchParams();
  const localTerminal = useUiStore((s) => s.terminalId);
  const localState = useCustomerDisplay(params.get("terminal") ?? localTerminal);
  const remote = useRemoteCustomerDisplay(apiEnabled&&!nativeDesktop, params.get("terminal"));
  const state = apiEnabled&&!nativeDesktop ? remote.state : localState;
  const [fullscreenRequested, setFullscreenRequested] = useState(params.get("fullscreen") === "true");
  const [fullscreenError, setFullscreenError] = useState("");
  const authenticated = useSessionStore((s) => s.authStatus === "authenticated");
  const q = useRepository("display-payment-methods", async () => ({ methods: await repositories.payments.list(), settings: await repositories.settings.get() }), !nativeDesktop && !apiEnabled && (localDemoEnabled || authenticated));
  const idle = state.mode === "IDLE" || !state.items.length;
  return <main className={`customer-display customer-display-${state.mode.toLowerCase()}`}>
    {fullscreenRequested && <div className="display-fullscreen-prompt"><Button variant="primary" onClick={() => void document.documentElement.requestFullscreen().then(() => setFullscreenRequested(false)).catch(() => setFullscreenError("Fullscreen was blocked. Allow fullscreen in your browser, then retry."))}>Enter Fullscreen</Button><Button onClick={() => setFullscreenRequested(false)}>Continue Windowed</Button>{fullscreenError && <p role="alert">{fullscreenError}</p>}</div>}
    <header><Logo /><span>TAHA MOBILES</span></header>
    {state.mode === "SALE_COMPLETE" ? <CompleteDisplay state={state} /> : idle || state.config?.enabled === false ? <IdleDisplay state={state} methods={q.data?.methods ?? []} /> : <OrderDisplay state={state} />}
    <footer><MonitorDot size={15} /> Customer Display · {nativeDesktop ? `Main Counter` : apiEnabled ? `${remote.status}${remote.status !== "Connected" && remote.code ? ` · Pairing code ${remote.code}` : ""}` : `Pairing code ${localPairingCode(state.terminalId)}`} · {state.config?.phone} {state.config?.address}{remote.error && <button className="text-link" onClick={remote.retry}>Reconnect Display</button>}</footer>
  </main>;
}

function IdleDisplay({ state, methods }: { state: CustomerDisplayState; methods: Array<{ id: string; name: string; kind: string; enabled?: boolean }> }) {
  const enabledMethods = state.config?.methods ?? methods.filter((m) => m.enabled !== false);
  return <div className="customer-display-body"><div className="customer-display-intro"><span className="eyebrow">YOUR LOCAL MOBILE SPECIALISTS</span><h1>Everything your phone needs.</h1><p>Quality mobile parts · Expert repairs · Everyday accessories</p></div>{state.config?.promotions !== false && <div className="promo-grid">{["Mobile Parts", "Repair Services", "Accessories"].map((title, i) => <section className="panel promo-card" key={title}><span>0{i + 1}</span><h2>{title}</h2><p>{["Reliable parts for the models you use.", "Careful diagnosis and practical advice.", "Chargers, cables, cases and more."][i]}</p></section>)}</div>}<div className="display-method-chips">{enabledMethods.map((m) => <span key={m.name}>{m.name}</span>)}</div><p className="customer-thank-you">Your order will appear here when the sale starts.</p></div>;
}

function OrderDisplay({ state }: { state: ReturnType<typeof useCustomerDisplay> }) {
  const payment = state.payment;
  return <div className="customer-display-body"><div className="customer-display-intro"><span className="eyebrow">{state.mode === "PAYMENT" ? "PAYMENT" : state.mode === "CHECKOUT" ? "CHECKOUT" : "YOUR SHOPPING SUMMARY"}</span><h1>{state.mode === "PAYMENT" ? "Waiting for customer payment" : "Your Order"}</h1></div><section className="customer-display-card"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>{state.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span>{item.variant}</span></td><td>{item.quantity}</td><td>{currency(item.unitPrice)}</td><td>{currency(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table><div className="customer-display-summary"><div><span>Subtotal</span><strong>{currency(state.subtotal)}</strong></div>{(state.negotiatedDiscount ?? 0) > 0 && <div><span>Discount included in prices</span><strong>{currency(state.negotiatedDiscount ?? 0)}</strong></div>}{(state.couponDiscount ?? state.discount) > 0 && <div><span>Coupon {state.couponCode}</span><strong>− {currency(state.couponDiscount ?? state.discount)}</strong></div>}{!!state.tax?.amount&&<div><span>{state.tax.name}{state.tax.mode==='Inclusive'?' (included)':''}</span><strong>{currency(state.tax.amount)}</strong></div>}<div className="display-total"><span>Total</span><strong>{currency(state.total)}</strong></div></div></section>{payment && <PaymentState payment={{ ...payment, qr: state.config?.paymentQr === false ? undefined : payment.qr }} />}</div>;
}

function PaymentState({ payment }: { payment: NonNullable<ReturnType<typeof useCustomerDisplay>["payment"]> }) {
  if (payment.kind === "Cash") return <section className="display-payment-state"><div><span>TOTAL</span><strong>{currency(payment.total)}</strong></div><div><span>CASH RECEIVED</span><strong>{currency(payment.cashReceived ?? payment.total)}</strong></div><div className="display-change"><span>CHANGE</span><strong>{currency(payment.change ?? 0)}</strong></div></section>;
  if (payment.kind === "Credit") return <section className="display-payment-state"><div><span>TOTAL</span><strong>{currency(payment.total)}</strong></div><div><span>PAID</span><strong>{currency(payment.paidNow ?? 0)}</strong></div><div><span>BALANCE</span><strong>{currency(payment.outstanding ?? payment.total)}</strong></div></section>;
  return <section className="display-digital-payment"><span className="eyebrow">TOTAL TO PAY</span><strong className="display-pay-amount">{currency(payment.total)}</strong><h2>{payment.method}</h2>{payment.qr && <PaymentQr image={payment.qr} name={payment.method} />}<p>{payment.title}</p><p>{payment.number}</p>{payment.iban && <p>{payment.iban}</p>}<small>Waiting for customer payment</small></section>;
}

function CompleteDisplay({ state }: { state: ReturnType<typeof useCustomerDisplay> }) {
  return <div className="customer-display-body display-complete"><span className="success-check">✓</span><span className="eyebrow">SALE COMPLETE · TAHA MOBILES</span><h1>Thank you</h1><strong className="display-invoice-number">{state.invoiceNumber}</strong><p>Total: <b>{currency(state.total)}</b></p><p>Payment: {state.payment?.method ?? "Confirmed"}</p><p>Your receipt is ready.</p>{state.invoiceNumber && <QRCodeSVG value={state.receiptUrl??state.invoiceNumber} size={112} title="Receipt reference QR" marginSize={2} />}<small>Receipt reference · {state.invoiceNumber}</small></div>;
}
