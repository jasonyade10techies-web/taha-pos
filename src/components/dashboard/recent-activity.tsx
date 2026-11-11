import {
  ShoppingBag,
  PackagePlus,
  ShieldCheck,
  Banknote,
  ArrowLeftRight,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { currency } from "../../lib/utils";
import type { DashboardData } from "../../types/dashboard";
import { mockAuthEnabled } from "../../lib/config";
import {activityLabel} from '../../lib/dashboard-actions';

const icons = {
  sale: ShoppingBag,
  stock: PackagePlus,
  approval: ShieldCheck,
  payment: Banknote,
  transfer: ArrowLeftRight,
};
export function RecentActivity({ data }: { data: DashboardData["activity"] }) {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Recent Activity</h2>
          <p>The latest from your shop</p>
        </div>
        <Link
          className="text-link"
          to="/audit-log"
          aria-label="View activity log"
        >
          <ArrowRight size={18} />
        </Link>
      </div>
      <div className="activity-list">
        {data.map((item) => {
          const Icon = icons[item.type as keyof typeof icons]??ShoppingBag;
          return (
            <Link to={item.href??'/audit-log'} className="activity-item" key={item.id}>
              <span className={`activity-icon activity-${item.type}`}>
                <Icon size={16} />
              </span>
              <div>
                <p>{activityLabel(item.text)}</p>
                <span>
                  {item.time}
                  {item.amount && <strong>{currency(item.amount)}</strong>}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="panel-footnote">
        {mockAuthEnabled ? (
          <>
            <span className="live-dot" />
            All activity is up to date{" "}
            <span className="ml-auto">Local history</span>
          </>
        ) : (
          "Recent recorded activity from your shop."
        )}
      </div>
    </section>
  );
}
