import { useQuery } from "@tanstack/react-query";
import { Monitor } from "lucide-react";
import { apiRequest } from "../../lib/api/client";
import { staffStorePath } from "../../lib/mobile/staff-service";
import { useDeviceBridgeStore } from "../../stores/device-bridge-store";
import type { CustomerDisplayState } from "../../types/phase4b";
import { currency } from "../../lib/utils";
import { Button } from "../../components/ui/button";
export function MobileDisplayPage() {
  const pair = useDeviceBridgeStore((s) => s.ownPair),
    terminal = pair?.terminalId;
  const query = useQuery({
    queryKey: ["staff-display-preview", terminal],
    queryFn: () =>
      apiRequest<{ online: boolean; snapshot: CustomerDisplayState | null }>(
        staffStorePath() +
          "/displays/preview?terminalId=" +
          encodeURIComponent(terminal || ""),
      ),
    enabled: !!terminal,
    refetchInterval: 2000,
  });
  const state = query.data?.snapshot;
  return (
    <div className="staff-page">
      <div className="staff-page-heading">
        <span className="eyebrow">COUNTER PREVIEW</span>
        <h1>Customer Display</h1>
        <p>{pair?.terminalName || "Pair a counter to view its display."}</p>
      </div>
      <div className="staff-section-heading">
        <span
          className={`staff-network ${query.data?.online ? "online" : "offline"}`}
        >
          <i />
          {query.data?.online ? "Online" : "Offline"}
        </span>
        <Button
          size="small"
          disabled={!terminal}
          onClick={() => void query.refetch()}
        >
          Reconnect
        </Button>
      </div>
      <section className="panel staff-display-preview">
        <strong>TAHA MOBILES</strong>
        {state && state.mode !== "IDLE" ? (
          <>
            <h2>
              {state.mode === "SALE_COMPLETE" ? "THANK YOU" : "YOUR ORDER"}
            </h2>
            {state.items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.name}
                  <small>
                    {item.variant} · Qty {item.quantity}
                  </small>
                </span>
                <b>{currency(item.quantity * item.unitPrice)}</b>
              </div>
            ))}
            <footer>
              <span>Total</span>
              <strong>{currency(state.total)}</strong>
            </footer>
            {state.payment && (
              <article className="staff-preview-payment">
                <h3>{state.payment.method}</h3>
                {state.payment.kind === "Cash" ? (
                  <p>
                    Cash received {currency(state.payment.cashReceived || 0)}
                    <br />
                    Change {currency(state.payment.change || 0)}
                  </p>
                ) : state.payment.kind === "Credit" ? (
                  <p>
                    Paid now {currency(state.payment.paidNow || 0)}
                    <br />
                    Remaining credit {currency(state.payment.outstanding || 0)}
                  </p>
                ) : (
                  <>
                    <p>
                      {state.payment.title}
                      <br />
                      {state.payment.number}
                      <br />
                      {state.payment.iban}
                    </p>
                    {state.payment.qr && (
                      <img
                        src={state.payment.qr}
                        alt={state.payment.method + " payment QR"}
                        width="150"
                        height="150"
                      />
                    )}
                  </>
                )}
              </article>
            )}
            {state.invoiceNumber && <p>{state.invoiceNumber}</p>}
          </>
        ) : (
          <>
            <Monitor size={44} />
            <h2>Welcome to Taha Mobiles</h2>
            <p>Mobile Parts · Repairs · Accessories</p>
          </>
        )}
      </section>
      {query.isError && <p role="alert">{query.error.message}</p>}
      <p className="staff-cache-label">
        Only customer-facing order information is shown here.
      </p>
    </div>
  );
}
