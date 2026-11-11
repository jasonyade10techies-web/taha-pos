import {
  ShoppingBag,
  Banknote,
  CreditCard,
  WalletCards,
  TrendingUp,
  PackageSearch,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { number } from "../../lib/utils";
import type { DashboardMetric } from "../../types/dashboard";
import {Link} from 'react-router-dom';

const icons = {
  sales: ShoppingBag,
  cash: Banknote,
  digital: CreditCard,
  credit: WalletCards,
  profit: TrendingUp,
  stock: PackageSearch,
};
export function KpiCard({ metric,href }: { metric: DashboardMetric;href?:string }) {
  const Icon = icons[metric.icon as keyof typeof icons];
  const positive =
    metric.change !== null &&
    (metric.icon === "credit" ? metric.change < 0 : metric.change >= 0);
  return (
    <Link to={href??'/reports'} className={`kpi-card kpi-${metric.icon}`} aria-label={`${metric.label} breakdown`}>
      <div className="kpi-label">
        <span>{metric.label}</span>
        <span className="kpi-icon">
          <Icon size={18} />
        </span>
      </div>
      <div className="kpi-value">
        {metric.icon !== "stock" && <span>PKR</span>}
        {metric.value === null ? "—" : number(metric.value)}
        {metric.icon === "stock" && <span>Items</span>}
      </div>
      <div className="kpi-comparison">
        {metric.change !== null ? (
          <>
            <span
              className={
                positive ? "comparison-positive" : "comparison-negative"
              }
            >
              {metric.change >= 0 ? (
                <ArrowUpRight size={13} />
              ) : (
                <ArrowDownRight size={13} />
              )}
              {Math.abs(metric.change)}%
            </span>
            <span>{metric.detail}</span>
          </>
        ) : (
          <span className="stock-attention">{metric.detail}</span>
        )}
      </div>
    </Link>
  );
}
