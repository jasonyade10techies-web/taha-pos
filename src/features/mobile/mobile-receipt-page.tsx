import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { mobileRead, staffService } from "../../lib/mobile/staff-service";
import type { Sale } from "../../types/demo";
import { currency } from "../../lib/utils";
export function MobileReceiptPage() {
  const [params] = useSearchParams(),
    reference = params.get("reference");
  const query = useQuery({
      queryKey: ["staff-receipt", reference],
      queryFn: async () => {
        const page = await staffService.sales(reference || undefined),
          row = page.data.rows.find((s) => s.invoice === reference);
        if (!row)
          throw new Error(
            "Receipt not found. Check the invoice number or reconnect.",
          );
        return mobileRead<Sale>("/sales/" + row.id);
      },
    }),
    sale = query.data?.data;
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">TAHA MOBILES</span>
        <h1>{reference}</h1>
        <p>Authorized receipt summary</p>
      </div>
      {query.isPending && <p role="status">Loading receipt…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {sale && (
        <section className="panel staff-detail-list">
          <h2>{sale.status}</h2>
          {sale.lines.map((line, i) => (
            <div key={i}>
              <strong>{line.name}</strong>
              <span>
                {line.quantity} × {currency(line.unitPrice)} ·{" "}
                {currency(line.total)}
              </span>
            </div>
          ))}
          <div>
            <span>Total</span>
            <strong>{currency(sale.total)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>{currency(sale.paid || 0)}</strong>
          </div>
          <p>Thank you for choosing Taha Mobiles.</p>
        </section>
      )}
    </div>
  );
}
