import type { Sale } from "../../types/demo";
import { currency } from "../../lib/utils";
import { useRepository } from "../../hooks/use-repository";
import { repositories } from "../../lib/repositories";
import { QRCodeSVG } from "qrcode.react";
import {receiptPayments} from '../../lib/payment-summary';
export function ReceiptPreview({
  sale,
  format = "receipt",
}: {
  sale: Sale;
  format?: "receipt" | "invoice";
}) {
  const settings = useRepository("receipt-settings", () =>
      repositories.settings.get(),
    ),
    invoice = format === "invoice";
  const paymentTotals=receiptPayments(sale),{outstanding}=paymentTotals,
    coupon = sale.couponDiscount ?? 0;
  const paper = sale.receipt ?? {
    branch: settings.data?.branch,
    phone: settings.data?.phone,
    address: settings.data?.address,
    footer: settings.data?.receiptFooter,
    showZeroTax: settings.data?.showZeroTax,
  };
  return (
    <section
      className={`receipt-preview paper-document print-area ${invoice ? "invoice-a4" : "thermal-receipt"}`}
      data-paper-format={format}
    >
      <header className="paper-header">
        <div>
          <h2>TAHA MOBILES</h2>
          <p>{paper.branch ?? "Main Branch"}</p>
          {paper.phone && <p>{paper.phone}</p>}
          {paper.address && <p>{paper.address}</p>}
          <strong className="paper-invoice-number">{sale.invoice}</strong>
          <p>
            {new Date(sale.createdAt).toLocaleString("en-PK", {
              timeZone: "Asia/Karachi",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          {sale.receipt?.showCashier!==false&&<p>Cashier: {sale.employeeName}</p>}
        </div>
        <div className="paper-qr">
          <QRCodeSVG
            value={sale.receiptUrl ?? sale.invoice}
            size={invoice ? 96 : 88}
            marginSize={4}
            level="M"
            title="Receipt QR"
          />
          <small>{invoice ? "Digital receipt" : "Receipt"}</small>
        </div>
      </header>
      <div className="paper-customer">
        <span>{sale.customerName}</span>
        <strong
          className={`paper-status paper-status-${sale.status.toLowerCase()}`}
        >
          {sale.syncStatus==='REFUNDED'?'REFUNDED':sale.status === "Voided" ? "VOID" : sale.status.toUpperCase()}
        </strong>
      </div>
      {sale.syncStatus==='REFUNDED'&&<p>Refunded in full. Original receipt retained for your records.</p>}
      {invoice && <h3 className="paper-title">INVOICE</h3>}
      <table className="paper-items">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            {invoice && (
              <>
                <th>Price</th>
                <th>Discount</th>
              </>
            )}
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line, index) => (
            <tr key={`${line.productId}-${index}`}>
              <td>
                {line.name}
                {line.variant && (invoice ? <span className="paper-variant"> · {line.variant}</span> : <small>{line.variant}</small>)}
                {!invoice && (
                  <small>
                    {line.quantity} × {currency(line.unitPrice)}
                  </small>
                )}
              </td>
              <td>{line.quantity}</td>
              {invoice && (
                <>
                  <td>{currency(line.unitPrice)}</td>
                  <td>{currency(line.discount)}</td>
                </>
              )}
              <td>{currency(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="paper-totals">
        <div>
          <span>Subtotal</span>
          <span>{currency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div>
            <span>Discount</span>
            <span>− {currency(sale.discount)}</span>
          </div>
        )}
        {coupon > 0 && (
          <div>
            <span>Coupon{sale.coupon ? ` · ${sale.coupon}` : ""}</span>
            <span>− {currency(coupon)}</span>
          </div>
        )}
        {((sale.tax?.amount ?? 0) > 0 || paper.showZeroTax) && (
          <div>
            <span>
              {sale.tax?.name ?? "Tax"}{" "}
              {sale.tax?.rate
                ? `(${sale.tax.rate}%${sale.tax.mode === "Inclusive" ? ", included" : ""})`
                : ""}
            </span>
            <span>{currency(sale.tax?.amount ?? 0)}</span>
          </div>
        )}
        <div className="paper-grand-total">
          <strong>Total</strong>
          <strong>{currency(sale.total)}</strong>
        </div>
        <div>
          <span>Paid</span>
          <span>{currency(paymentTotals.received)}</span>
        </div>
        {paymentTotals.refunded>0&&<div><span>Refunded</span><span>{currency(paymentTotals.refunded)}</span></div>}
        {paymentTotals.reversed>0&&<div><span>Payment reversed</span><span>{currency(paymentTotals.reversed)}</span></div>}
        {(paymentTotals.refunded>0||paymentTotals.reversed>0)&&<div><span>Net paid</span><span>{currency(paymentTotals.paid)}</span></div>}
        {outstanding > 0 && (
          <div>
            <span>Outstanding</span>
            <strong>{currency(outstanding)}</strong>
          </div>
        )}
        {(sale.change ?? 0) > 0 && (
          <div>
            <span>Change</span>
            <strong>{currency(sale.change ?? 0)}</strong>
          </div>
        )}
      </div>
      <div className="paper-payments">
        {sale.payments.map((payment, index) => (
          <small key={payment.id ?? index}>
            {payment.kind==='refund'?'Refund · ':payment.kind==='reversal'?'Reversal · ':''}{payment.methodName ?? payment.methodId} ·{" "}
            {currency(payment.amount)}
            {payment.reference ? ` · ${payment.reference}` : ""}
          </small>
        ))}
      </div>
      <footer className="paper-footer">
        {paper.footer || "Thank you for choosing Taha Mobiles."}
        <small>{sale.invoice}</small>
      </footer>
    </section>
  );
}
