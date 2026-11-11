import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { currency } from "../../lib/utils";
import type { DashboardData } from "../../types/dashboard";
import { mockAuthEnabled } from "../../lib/config";

export function CreditReminders({ data }: { data: DashboardData["credit"] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Credit Reminders</h2>
        <Link className="text-link" to="/credit">
          View accounts
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="credit-list">
        {data.map((item) => (
          <Link to={item.id?'/customers/'+item.id:'/credit'} className="credit-item" key={item.id??item.name}>
            <span className="avatar credit-avatar">{item.initials}</span>
            <div>
              <strong>{item.name}</strong>
              <small className={item.overdue ? "text-danger" : "text-muted"}>
                {item.due}
              </small>
              {item.taken&&<small className="text-muted">Taken on {item.taken}</small>}
            </div>
            <span>{currency(item.amount)}</span>
          </Link>
        ))}
      </div>
      <div className="panel-footnote">
        {mockAuthEnabled
          ? `${data.length} accounts need your attention.`
          : "Open an account to review credit and collect payment."}
      </div>
    </section>
  );
}
