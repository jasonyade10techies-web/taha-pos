import { Link,useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "../ui/badge";
import type { DashboardData } from "../../types/dashboard";

export function LowStockTable({
  data,
  count,
}: {
  data: DashboardData["lowStock"];
  count: number | null;
}) {
  const navigate=useNavigate();
  const destination=(item:DashboardData['lowStock'][number])=>item.id?'/products/'+item.id+'?view=stock':'/products?search='+encodeURIComponent(item.code);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="flex items-center gap-2.5">
          <h2>Low Stock</h2>
          <Badge tone="warning">{count ?? "—"} items</Badge>
        </div>
        <Link className="text-link" to="/low-stock">
          View all
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Stock / Min.</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.code} className="clickable-row" tabIndex={0} onClick={event=>{if(!(event.target instanceof Element&&event.target.closest('a,button')))navigate(destination(item));}} onKeyDown={event=>{if(event.target===event.currentTarget&&['Enter',' '].includes(event.key)){event.preventDefault();navigate(destination(item));}}}>
                <td>
                  <Link className="dashboard-product-link" to={destination(item)}><strong>{item.name}</strong></Link>
                  <small>{item.code}</small>
                </td>
                <td className="tabular-nums">
                  <span className="text-warning font-semibold">
                    {item.current}
                  </span>
                  <span className="text-muted"> / {item.minimum}</span>
                </td>
                <td className="text-muted">{item.location}</td>
                <td>
                  <Badge tone="warning">Low stock</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-footnote">
        Replenish these products to keep sales moving.
      </div>
    </section>
  );
}
