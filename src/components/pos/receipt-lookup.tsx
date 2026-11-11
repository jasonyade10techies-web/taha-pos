import { useState } from "react";
import { Receipt, ChevronRight } from "lucide-react";
import { repositories as r } from "../../lib/repositories";
import { useRepository } from "../../hooks/use-repository";
import { SearchInput, QueryState, EmptyState } from "../ui/workspace";
import { Button } from "../ui/button";
import type { Sale } from "../../types/demo";
import { currency } from "../../lib/utils";
import { shopTimestamp } from "../../lib/shop-time";
import {useShopConfiguration} from '../../hooks/use-shop-configuration';
import "./receipt-lookup.css";
export function ReceiptLookup({
  onSelect,
}: {
  onSelect: (sale: Sale) => void;
}) {
  const {ownerOnly}=useShopConfiguration();
  const limit=7;
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const q = useRepository(
    "return-receipt-search-" + search + "-" + page,
    () =>
      r.sales.lookup?.({ search, page, limit }) ??
      r.sales.page?.({ search, page, limit }) ??
      Promise.resolve({ rows: [], total: 0, page: 0, limit }),
  );
  return (
    <section className="receipt-lookup">
      <h2>Search Receipt</h2>
      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search invoice, customer, phone or product..."
        label="Search Receipt"
      />
      <p className="text-muted text-sm">
        Partial invoice numbers show matching receipts. Select the correct
        invoice to start a return.
      </p>
      <QueryState
        pending={q.isPending}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data?.rows.length ? (
          <div className="receipt-candidates">
            {q.data.rows.map((sale) => (
              <button
                key={sale.id}
                onClick={() => onSelect(sale)}

              >
                <span className="receipt-candidate-icon">
                  <Receipt size={20} />
                </span>
                <span>
                  <strong>{sale.invoice}</strong>
                  <span>
                    {sale.customerName} · {shopTimestamp(sale.createdAt)}
                  </span>
                  <small>
                    {!ownerOnly&&<>Cashier: {sale.employeeName} · </>}{sale.status}
                  </small>
                </span>
                <span className="receipt-candidate-total">
                  <strong>{currency(sale.total)}</strong>
                  <ChevronRight size={16} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching receipts"
            description="Try part of the invoice, the customer's phone, product name or cashier."
          />
        )}
        <div className="activity-pagination">
          <small>{q.data?.total ?? 0} matching receipts</small>
          <Button
            size="small"
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            size="small"
            disabled={(page + 1) * limit >= (q.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </QueryState>
    </section>
  );
}
